-- Separa la configuració de materials per lot i zona.
-- No modifica inventaris, mínims, consums ni moviments.
begin;

create table if not exists public.material_scope_settings (
  lot text not null,
  zone text not null,
  material text not null references public.material_settings(material) on update cascade on delete restrict,
  supply_type text not null check (supply_type in ('standard','supervisor')),
  unit_visible boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (lot,zone,material)
);

insert into public.material_scope_settings(lot,zone,material,supply_type,unit_visible)
select scopes.lot,scopes.zone,m.material,m.supply_type,m.unit_visible
from public.material_settings m
cross join (select distinct lot,zone from public.warehouses) scopes
on conflict (lot,zone,material) do nothing;

alter table public.material_scope_settings enable row level security;
drop policy if exists "Authenticated users read scoped material settings" on public.material_scope_settings;
create policy "Authenticated users read scoped material settings"
on public.material_scope_settings for select to authenticated using (auth.uid() is not null);

revoke all on table public.material_scope_settings from public,anon;
revoke insert,update,delete,truncate,references,trigger on table public.material_scope_settings from authenticated;
grant select on table public.material_scope_settings to authenticated;

create or replace function public.get_material_configuration(p_lot text,p_zone text)
returns table(material text,supply_type text,unit_visible boolean)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not exists(select 1 from public.warehouses where lot=p_lot and zone=p_zone) then
    raise exception 'UNKNOWN_MATERIAL_SCOPE';
  end if;
  insert into public.material_scope_settings(lot,zone,material,supply_type,unit_visible)
  select p_lot,p_zone,m.material,m.supply_type,m.unit_visible
  from public.material_settings m
  on conflict on constraint material_scope_settings_pkey do nothing;

  return query
  select s.material,s.supply_type,s.unit_visible
  from public.material_scope_settings s
  where s.lot=p_lot and s.zone=p_zone
  order by s.material;
end;
$$;

revoke all on function public.get_material_configuration(text,text) from public,anon;
grant execute on function public.get_material_configuration(text,text) to authenticated;

drop function if exists public.set_material_configuration(text,text,boolean);
create or replace function public.set_material_configuration(
  p_lot text,
  p_zone text,
  p_material text,
  p_supply_type text,
  p_unit_visible boolean
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_updated integer;
begin
  if not public.admin_has_role(array['owner','logistics']) then
    raise exception 'ADMIN_ROLE_ACCESS_DENIED';
  end if;
  if p_lot is null or length(trim(p_lot)) = 0
     or p_zone is null or length(trim(p_zone)) = 0
     or p_material is null or length(trim(p_material)) = 0
     or p_supply_type not in ('standard','supervisor')
     or p_unit_visible is null then
    raise exception 'INVALID_MATERIAL_CONFIGURATION';
  end if;
  if not exists (
    select 1 from public.warehouses
    where lot = p_lot and zone = p_zone
  ) then
    raise exception 'UNKNOWN_MATERIAL_SCOPE';
  end if;

  insert into public.material_scope_settings(lot,zone,material,supply_type,unit_visible)
  select p_lot,p_zone,m.material,m.supply_type,m.unit_visible
  from public.material_settings m
  on conflict on constraint material_scope_settings_pkey do nothing;

  update public.material_scope_settings
  set supply_type = p_supply_type,
      unit_visible = p_unit_visible,
      updated_at = now()
  where lot = p_lot and zone = p_zone and material = p_material;
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then raise exception 'UNKNOWN_MATERIAL'; end if;
  return v_updated;
end;
$$;

revoke all on function public.set_material_configuration(text,text,text,text,boolean) from public,anon;
grant execute on function public.set_material_configuration(text,text,text,text,boolean) to authenticated;

commit;

select lot,zone,count(*) as materials
from public.material_scope_settings
group by lot,zone
order by lot,zone;
