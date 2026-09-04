alter table public.stock_movements add column if not exists operation_id uuid;
alter table public.stock_movements add column if not exists performed_role text;
alter table public.stock_movements add column if not exists performed_zone text;
create index if not exists stock_movements_operation_idx on public.stock_movements(operation_id);

create or replace function public.transfer_stock_recorded(p_origin_id text,p_destination_id text,p_items jsonb)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_material text; v_quantity integer; v_available integer; v_origin_kind text; v_destination_kind text; v_origin_zone text; v_destination_zone text; v_role text; v_role_zone text; v_operation uuid := gen_random_uuid();
begin
  perform public.require_admin_warehouse(p_origin_id); perform public.require_admin_warehouse(p_destination_id);
  select kind,zone into v_origin_kind,v_origin_zone from public.warehouses where id=p_origin_id;
  select kind,zone into v_destination_kind,v_destination_zone from public.warehouses where id=p_destination_id;
  if v_origin_kind is distinct from 'central' or v_destination_kind is distinct from 'subwarehouse' or v_origin_zone is distinct from v_destination_zone then raise exception 'INVALID_TRANSFER'; end if;
  select role,zone into v_role,v_role_zone from public.admin_access_sessions where user_id=auth.uid() and expires_at>now();
  for v_material,v_quantity in select key,value::integer from jsonb_each_text(coalesce(p_items,'{}'::jsonb)) order by key loop
    if v_quantity<=0 then continue; end if;
    perform pg_advisory_xact_lock(hashtextextended(p_origin_id||':'||v_material,1)); perform pg_advisory_xact_lock(hashtextextended(p_destination_id||':'||v_material,1));
    select quantity into v_available from public.warehouse_inventory where warehouse_id=p_origin_id and material=v_material for update;
    if coalesce(v_available,0)<v_quantity then raise exception 'Insufficient stock for %',v_material; end if;
    update public.warehouse_inventory set quantity=quantity-v_quantity,updated_at=now() where warehouse_id=p_origin_id and material=v_material;
    update public.warehouse_inventory set quantity=quantity+v_quantity,updated_at=now() where warehouse_id=p_destination_id and material=v_material;
    insert into public.stock_movements(warehouse_id,material,delta,movement_type,operation_id,performed_role,performed_zone) values
      (p_origin_id,v_material,-v_quantity,'transfer_out',v_operation,v_role,v_role_zone),
      (p_destination_id,v_material,v_quantity,'transfer_in',v_operation,v_role,v_role_zone);
  end loop;
  return v_operation;
end; $$;
revoke execute on function public.transfer_stock_recorded(text,text,jsonb) from public,anon;
grant execute on function public.transfer_stock_recorded(text,text,jsonb) to authenticated;
