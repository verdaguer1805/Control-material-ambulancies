-- Mínimo central automático y margen de seguridad por material.
alter table public.warehouse_inventory
  add column if not exists minimum_base_quantity integer not null default 0,
  add column if not exists safety_percentage integer not null default 30;

alter table public.warehouse_inventory
  drop constraint if exists warehouse_inventory_safety_percentage_check;
alter table public.warehouse_inventory
  add constraint warehouse_inventory_safety_percentage_check
  check (safety_percentage between 0 and 200);

create or replace function public.recalculate_olot_central_minimum(p_material text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_camprodon integer := 0;
  v_campdevanol integer := 0;
  v_banyoles integer := 0;
  v_base integer := 0;
  v_safety integer := 30;
begin
  select coalesce(max(minimum_quantity) filter (where warehouse_id = 'lot5_olot_camprodon'), 0),
         coalesce(max(minimum_quantity) filter (where warehouse_id = 'lot5_olot_campdevanol'), 0),
         coalesce(max(minimum_quantity) filter (where warehouse_id = 'lot5_olot_banyoles'), 0)
    into v_camprodon, v_campdevanol, v_banyoles
  from public.warehouse_inventory
  where material = p_material;

  -- Tres unidades directas de Olot, más Camprodon, Campdevànol y Banyoles.
  -- No se incluyen G205, G215, G305 ni Material supervisor.
  v_base := (v_camprodon * 4) + v_campdevanol + v_banyoles;

  select coalesce(safety_percentage, 30)
    into v_safety
  from public.warehouse_inventory
  where warehouse_id = 'lot5_olot_central' and material = p_material;

  update public.warehouse_inventory
  set minimum_base_quantity = v_base,
      minimum_quantity = ceil(v_base * (1 + v_safety / 100.0))::integer,
      updated_at = now()
  where warehouse_id = 'lot5_olot_central' and material = p_material;
end;
$$;

create or replace function public.recalculate_olot_central_minimum_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.recalculate_olot_central_minimum(new.material);
  return new;
end;
$$;

drop trigger if exists recalculate_olot_central_minimum_on_subwarehouse on public.warehouse_inventory;
create trigger recalculate_olot_central_minimum_on_subwarehouse
after update of minimum_quantity on public.warehouse_inventory
for each row
when (new.warehouse_id in ('lot5_olot_camprodon', 'lot5_olot_campdevanol', 'lot5_olot_banyoles'))
execute function public.recalculate_olot_central_minimum_trigger();

create or replace function public.set_inventory_safety_percentages(
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
  v_material text;
begin
  if not public.admin_has_role(array['owner', 'logistics']) then
    raise exception 'ADMIN_ROLE_ACCESS_DENIED';
  end if;
  if p_warehouse_id <> 'lot5_olot_central' then
    raise exception 'SAFETY_PERCENTAGE_ONLY_CENTRAL';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'object' then
    raise exception 'INVALID_SAFETY_PERCENTAGES';
  end if;
  if exists (
    select 1 from jsonb_each_text(p_items) as item
    where item.value !~ '^\d+$' or item.value::integer not between 0 and 200
  ) then
    raise exception 'INVALID_SAFETY_PERCENTAGE';
  end if;

  select count(*) into v_requested from jsonb_object_keys(p_items);
  update public.warehouse_inventory as inventory
  set safety_percentage = item.value::integer,
      updated_at = now()
  from jsonb_each_text(p_items) as item
  where inventory.warehouse_id = p_warehouse_id
    and inventory.material = item.key;
  get diagnostics v_updated = row_count;
  if v_updated <> v_requested then
    raise exception 'INVENTORY_ITEM_NOT_FOUND';
  end if;

  for v_material in select jsonb_object_keys(p_items)
  loop
    perform public.recalculate_olot_central_minimum(v_material);
  end loop;
  return v_updated;
end;
$$;

revoke execute on function public.set_inventory_safety_percentages(text,jsonb) from public, anon;
grant execute on function public.set_inventory_safety_percentages(text,jsonb) to authenticated;

update public.warehouse_inventory
set safety_percentage = 30
where warehouse_id = 'lot5_olot_central';

do $$
declare v_material text;
begin
  for v_material in
    select material from public.warehouse_inventory where warehouse_id = 'lot5_olot_central'
  loop
    perform public.recalculate_olot_central_minimum(v_material);
  end loop;
end;
$$;
