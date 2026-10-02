-- Permet regularitzar inventaris amb estoc anterior negatiu.
-- El valor nou continua obligat a ser un enter igual o superior a zero.
begin;

create or replace function public.set_inventory_quantities_optimistic(
  p_warehouse_id text, p_items jsonb, p_expected jsonb
) returns integer language plpgsql security definer set search_path='' as $$
declare
  v_updated integer;
  v_requested integer;
  v_role text;
  v_role_zone text;
  v_operation uuid := gen_random_uuid();
begin
  if p_items is null or jsonb_typeof(p_items)<>'object'
     or p_expected is null or jsonb_typeof(p_expected)<>'object' then
    raise exception 'INVALID_INVENTORY';
  end if;

  if exists(
       select 1 from jsonb_each_text(p_items) i
       where i.value !~ '^[0-9]+$'
          or i.value::numeric > 2147483647
     )
     or exists(
       select 1 from jsonb_each_text(p_expected) i
       where i.value !~ '^-?[0-9]+$'
          or i.value::numeric < -2147483648
          or i.value::numeric > 2147483647
     ) then
    raise exception 'INVALID_QUANTITY';
  end if;

  perform public.require_admin_warehouse(p_warehouse_id);
  select role, zone into v_role, v_role_zone
  from public.admin_access_sessions
  where user_id=auth.uid() and expires_at>now();
  if v_role is null then raise exception 'ADMIN_ROLE_ACCESS_DENIED'; end if;

  select count(*) into v_requested from jsonb_object_keys(p_items);
  if v_requested<>(select count(*) from jsonb_object_keys(p_expected))
     or exists(select 1 from jsonb_object_keys(p_items) k where not (p_expected ? k)) then
    raise exception 'INVALID_EXPECTED_INVENTORY';
  end if;

  perform 1 from public.warehouse_inventory w
  where w.warehouse_id=p_warehouse_id and w.material in(select jsonb_object_keys(p_items))
  order by w.material for update;
  if (select count(*) from public.warehouse_inventory w where w.warehouse_id=p_warehouse_id
      and w.material in(select jsonb_object_keys(p_items)))<>v_requested then
    raise exception 'INVENTORY_ITEM_NOT_FOUND';
  end if;
  if exists(select 1 from jsonb_each_text(p_expected) e join public.warehouse_inventory w
      on w.warehouse_id=p_warehouse_id and w.material=e.key where w.quantity<>e.value::integer) then
    raise exception 'INVENTORY_CONFLICT';
  end if;

  insert into public.stock_movements(
    warehouse_id, material, delta, movement_type, operation_id,
    performed_role, performed_zone, previous_quantity, new_quantity, actor_user_id
  )
  select p_warehouse_id, w.material, i.value::integer-w.quantity,
    'inventory_adjustment', v_operation, v_role, v_role_zone,
    w.quantity, i.value::integer, auth.uid()
  from jsonb_each_text(p_items) i
  join public.warehouse_inventory w
    on w.warehouse_id=p_warehouse_id and w.material=i.key
  where w.quantity is distinct from i.value::integer;

  update public.warehouse_inventory w
  set quantity=i.value::integer, updated_at=now()
  from jsonb_each_text(p_items) i
  where w.warehouse_id=p_warehouse_id and w.material=i.key;
  get diagnostics v_updated=row_count;
  return v_updated;
end $$;

revoke all on function public.set_inventory_quantities_optimistic(text,jsonb,jsonb)
  from public,anon;
grant execute on function public.set_inventory_quantities_optimistic(text,jsonb,jsonb)
  to authenticated;

commit;
