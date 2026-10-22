-- Central receipts: real quantities only, actor from validated server session.
-- No historical movement/stock backfill. No grants or access scope expansion.
begin;
alter table public.warehouse_inventory alter column quantity set default 0;
create or replace function public.receive_central_stock_role_impl(p_warehouse_id text,p_items jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare
 v_material text; v_quantity integer; v_kind text; v_role text; v_zone text;
 v_operation uuid:=gen_random_uuid();
begin
 perform public.require_admin_warehouse(p_warehouse_id);
 select role,zone into v_role,v_zone from public.admin_access_sessions
 where user_id=auth.uid() and expires_at>now();
 if v_role is null or v_role not in ('owner','logistics','supervisor')
 then raise exception 'ADMIN_ROLE_ACCESS_DENIED'; end if;
 select kind into v_kind from public.warehouses where id=p_warehouse_id;
 if v_kind is distinct from 'central' then raise exception 'Destination must be a central warehouse'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'object' then raise exception 'INVALID_QUANTITY'; end if;
 if exists(select 1 from jsonb_each_text(p_items) i
   where i.value is null or i.value !~ '^[0-9]+$' or i.value::numeric>2147483647)
 then raise exception 'INVALID_QUANTITY'; end if;
 for v_material,v_quantity in select key,value::integer from jsonb_each_text(p_items) order by key loop
   if v_quantity=0 then continue; end if;
   perform pg_advisory_xact_lock(hashtextextended(p_warehouse_id||':'||v_material,1));
   insert into public.warehouse_inventory(warehouse_id,material,quantity,updated_at)
   values(p_warehouse_id,v_material,v_quantity,now())
   on conflict(warehouse_id,material) do update
     set quantity=public.warehouse_inventory.quantity+v_quantity,updated_at=now();
   insert into public.stock_movements(warehouse_id,material,delta,movement_type,operation_id,performed_role,performed_zone,actor_user_id)
   values(p_warehouse_id,v_material,v_quantity,'central_receipt',v_operation,v_role,v_zone,auth.uid());
 end loop;
end $$;
commit;
