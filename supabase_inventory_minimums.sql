-- Mínimos configurables por material y almacén.
alter table public.warehouse_inventory
  add column if not exists minimum_quantity integer not null default 0;

alter table public.warehouse_inventory
  drop constraint if exists warehouse_inventory_minimum_quantity_check;

alter table public.warehouse_inventory
  add constraint warehouse_inventory_minimum_quantity_check
  check (minimum_quantity >= 0);

create or replace function public.set_inventory_minimum(
  p_warehouse_id text,
  p_material text,
  p_minimum integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.admin_has_role(array['owner', 'logistics']) then
    raise exception 'ADMIN_ROLE_ACCESS_DENIED';
  end if;
  if p_minimum is null or p_minimum < 0 then
    raise exception 'INVALID_MINIMUM';
  end if;
  perform public.require_admin_warehouse(p_warehouse_id);
  update public.warehouse_inventory
  set minimum_quantity = p_minimum,
      updated_at = now()
  where warehouse_id = p_warehouse_id
    and material = p_material;
  if not found then
    raise exception 'INVENTORY_ITEM_NOT_FOUND';
  end if;
end;
$$;

revoke execute on function public.set_inventory_minimum(text,text,integer) from public, anon;
grant execute on function public.set_inventory_minimum(text,text,integer) to authenticated;
