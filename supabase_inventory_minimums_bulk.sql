-- Edición conjunta y atómica de los mínimos de un almacén.
create or replace function public.set_inventory_minimums(
  p_warehouse_id text,
  p_items jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
  v_requested integer;
begin
  if not public.admin_has_role(array['owner', 'logistics']) then
    raise exception 'ADMIN_ROLE_ACCESS_DENIED';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'object' then
    raise exception 'INVALID_MINIMUMS';
  end if;
  if exists (
    select 1
    from jsonb_each_text(p_items) as item
    where item.value !~ '^\d+$'
       or item.value::numeric > 2147483647
  ) then
    raise exception 'INVALID_MINIMUM';
  end if;

  perform public.require_admin_warehouse(p_warehouse_id);

  select count(*) into v_requested from jsonb_object_keys(p_items);

  update public.warehouse_inventory as inventory
  set minimum_quantity = item.value::integer,
      updated_at = now()
  from jsonb_each_text(p_items) as item
  where inventory.warehouse_id = p_warehouse_id
    and inventory.material = item.key;

  get diagnostics v_updated = row_count;
  if v_updated <> v_requested then
    raise exception 'INVENTORY_ITEM_NOT_FOUND';
  end if;
  return v_updated;
end;
$$;

revoke execute on function public.set_inventory_minimums(text,jsonb) from public, anon;
grant execute on function public.set_inventory_minimums(text,jsonb) to authenticated;
