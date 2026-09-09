-- Clasificación independiente del material: estándar o supervisor.
-- La carga inicial utiliza los mínimos actuales una sola vez.
create table if not exists public.material_settings (
  material text primary key,
  supply_type text not null check (supply_type in ('standard', 'supervisor')),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

alter table public.material_settings enable row level security;

drop policy if exists "Authenticated users can read material settings" on public.material_settings;
create policy "Authenticated users can read material settings"
  on public.material_settings for select to authenticated
  using (true);

insert into public.material_settings (material, supply_type)
select
  inventory.material,
  case
    when coalesce(max(inventory.minimum_quantity) filter (where warehouse.kind = 'subwarehouse'), 0) = 0
      then 'supervisor'
    else 'standard'
  end
from public.warehouse_inventory as inventory
join public.warehouses as warehouse on warehouse.id = inventory.warehouse_id
group by inventory.material
on conflict (material) do nothing;

create or replace function public.set_material_supply_type(
  p_material text,
  p_supply_type text
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
  if p_supply_type not in ('standard', 'supervisor') then
    raise exception 'INVALID_SUPPLY_TYPE';
  end if;
  if not exists (
    select 1 from public.warehouse_inventory where material = p_material
  ) then
    raise exception 'UNKNOWN_MATERIAL';
  end if;

  insert into public.material_settings (material, supply_type, updated_at, updated_by)
  values (p_material, p_supply_type, now(), auth.uid())
  on conflict (material) do update
    set supply_type = excluded.supply_type,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;
end;
$$;

revoke all on table public.material_settings from public, anon;
grant select on table public.material_settings to authenticated;
revoke execute on function public.set_material_supply_type(text, text) from public, anon;
grant execute on function public.set_material_supply_type(text, text) to authenticated;
