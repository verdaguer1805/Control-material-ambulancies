-- Evita que dos administradores sobrescriban valores absolutos vistos antes
-- de que el otro dispositivo los modificara.
begin;

create or replace function public.set_inventory_quantities_optimistic(
  p_warehouse_id text, p_items jsonb, p_expected jsonb
) returns integer language plpgsql security definer set search_path='' as $$
declare v_updated integer; v_requested integer;
begin
  if p_items is null or jsonb_typeof(p_items)<>'object'
     or p_expected is null or jsonb_typeof(p_expected)<>'object' then raise exception 'INVALID_INVENTORY'; end if;
  if exists(select 1 from jsonb_each_text(p_items) i where i.value!~'^\d+$' or i.value::numeric>2147483647)
     or exists(select 1 from jsonb_each_text(p_expected) i where i.value!~'^\d+$' or i.value::numeric>2147483647)
     then raise exception 'INVALID_QUANTITY'; end if;
  perform public.require_admin_warehouse(p_warehouse_id);
  select count(*) into v_requested from jsonb_object_keys(p_items);
  if v_requested<>(select count(*) from jsonb_object_keys(p_expected))
     or exists(select 1 from jsonb_object_keys(p_items) k where not (p_expected ? k)) then raise exception 'INVALID_EXPECTED_INVENTORY'; end if;
  perform 1 from public.warehouse_inventory w
   where w.warehouse_id=p_warehouse_id and w.material in(select jsonb_object_keys(p_items))
   order by w.material for update;
  if (select count(*) from public.warehouse_inventory w where w.warehouse_id=p_warehouse_id
      and w.material in(select jsonb_object_keys(p_items)))<>v_requested then raise exception 'INVENTORY_ITEM_NOT_FOUND'; end if;
  if exists(select 1 from jsonb_each_text(p_expected) e join public.warehouse_inventory w
      on w.warehouse_id=p_warehouse_id and w.material=e.key where w.quantity<>e.value::integer)
     then raise exception 'INVENTORY_CONFLICT'; end if;
  update public.warehouse_inventory w set quantity=i.value::integer,updated_at=now()
   from jsonb_each_text(p_items) i where w.warehouse_id=p_warehouse_id and w.material=i.key;
  get diagnostics v_updated=row_count;
  return v_updated;
end $$;

create or replace function public.set_inventory_minimums_optimistic(
  p_warehouse_id text, p_items jsonb, p_expected jsonb
) returns integer language plpgsql security definer set search_path='' as $$
declare v_updated integer; v_requested integer;
begin
  if not public.admin_has_role(array['owner','logistics']) then raise exception 'ADMIN_ROLE_ACCESS_DENIED'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'object'
     or p_expected is null or jsonb_typeof(p_expected)<>'object' then raise exception 'INVALID_MINIMUMS'; end if;
  if exists(select 1 from jsonb_each_text(p_items) i where i.value!~'^\d+$' or i.value::numeric>2147483647)
     or exists(select 1 from jsonb_each_text(p_expected) i where i.value!~'^\d+$' or i.value::numeric>2147483647)
     then raise exception 'INVALID_MINIMUM'; end if;
  perform public.require_admin_warehouse(p_warehouse_id);
  select count(*) into v_requested from jsonb_object_keys(p_items);
  if v_requested<>(select count(*) from jsonb_object_keys(p_expected))
     or exists(select 1 from jsonb_object_keys(p_items) k where not (p_expected ? k)) then raise exception 'INVALID_EXPECTED_INVENTORY'; end if;
  perform 1 from public.warehouse_inventory w
   where w.warehouse_id=p_warehouse_id and w.material in(select jsonb_object_keys(p_items))
   order by w.material for update;
  if exists(select 1 from jsonb_each_text(p_expected) e join public.warehouse_inventory w
      on w.warehouse_id=p_warehouse_id and w.material=e.key where w.minimum_quantity<>e.value::integer)
     then raise exception 'INVENTORY_CONFLICT'; end if;
  update public.warehouse_inventory w set minimum_quantity=i.value::integer,updated_at=now()
   from jsonb_each_text(p_items) i where w.warehouse_id=p_warehouse_id and w.material=i.key;
  get diagnostics v_updated=row_count;
  if v_updated<>v_requested then raise exception 'INVENTORY_ITEM_NOT_FOUND'; end if;
  return v_updated;
end $$;

create or replace function public.set_safety_percentages_optimistic(
  p_warehouse_id text, p_items jsonb, p_expected jsonb
) returns integer language plpgsql security definer set search_path='' as $$
declare v_requested integer; v_result integer;
begin
  if not public.admin_has_role(array['owner','logistics']) then raise exception 'ADMIN_ROLE_ACCESS_DENIED'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'object'
     or p_expected is null or jsonb_typeof(p_expected)<>'object' then raise exception 'INVALID_SAFETY_PERCENTAGES'; end if;
  if exists(select 1 from jsonb_each_text(p_items) i where i.value!~'^\d+$' or i.value::integer not between 0 and 200)
     or exists(select 1 from jsonb_each_text(p_expected) i where i.value!~'^\d+$' or i.value::integer not between 0 and 200)
     then raise exception 'INVALID_SAFETY_PERCENTAGE'; end if;
  perform public.require_admin_warehouse(p_warehouse_id);
  select count(*) into v_requested from jsonb_object_keys(p_items);
  if v_requested<>(select count(*) from jsonb_object_keys(p_expected))
     or exists(select 1 from jsonb_object_keys(p_items) k where not (p_expected ? k)) then raise exception 'INVALID_EXPECTED_INVENTORY'; end if;
  perform 1 from public.warehouse_inventory w
   where w.warehouse_id=p_warehouse_id and w.material in(select jsonb_object_keys(p_items))
   order by w.material for update;
  if exists(select 1 from jsonb_each_text(p_expected) e join public.warehouse_inventory w
      on w.warehouse_id=p_warehouse_id and w.material=e.key where w.safety_percentage<>e.value::integer)
     then raise exception 'INVENTORY_CONFLICT'; end if;
  if p_warehouse_id='lot5_olot_central' then
    v_result:=public.set_inventory_safety_percentages(p_warehouse_id,p_items);
  else
    v_result:=public.set_expansion_safety_percentages(p_warehouse_id,p_items);
  end if;
  return v_result;
end $$;

revoke all on function public.set_inventory_quantities_optimistic(text,jsonb,jsonb) from public,anon;
revoke all on function public.set_inventory_minimums_optimistic(text,jsonb,jsonb) from public,anon;
revoke all on function public.set_safety_percentages_optimistic(text,jsonb,jsonb) from public,anon;
grant execute on function public.set_inventory_quantities_optimistic(text,jsonb,jsonb) to authenticated;
grant execute on function public.set_inventory_minimums_optimistic(text,jsonb,jsonb) to authenticated;
grant execute on function public.set_safety_percentages_optimistic(text,jsonb,jsonb) to authenticated;

commit;
