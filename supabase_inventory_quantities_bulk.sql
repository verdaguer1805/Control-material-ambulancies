-- Edición conjunta y atómica del inventario real de un almacén.
create or replace function public.set_inventory_quantities(
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
  if p_items is null or jsonb_typeof(p_items) <> 'object' then
    raise exception 'INVALID_INVENTORY';
  end if;
  if exists (
    select 1
    from jsonb_each_text(p_items) as item
    where item.value !~ '^\d+$'
       or item.value::numeric > 2147483647
  ) then
    raise exception 'INVALID_QUANTITY';
  end if;

  perform public.require_admin_warehouse(p_warehouse_id);
  select count(*) into v_requested from jsonb_object_keys(p_items);

  update public.warehouse_inventory as inventory
  set quantity = item.value::integer,
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

revoke execute on function public.set_inventory_quantities(text,jsonb) from public, anon;
grant execute on function public.set_inventory_quantities(text,jsonb) to authenticated;
