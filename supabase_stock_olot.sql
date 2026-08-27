-- Pilot d'estoc real: Lot 5 / Supervisió Olot
-- És segur tornar a executar aquest fitxer: no reinicia inventaris existents.

create table if not exists public.warehouses (
  id text primary key,
  lot text not null,
  zone text not null,
  name text not null,
  kind text not null check (kind in ('central', 'subwarehouse')),
  created_at timestamptz not null default now()
);

create table if not exists public.unit_warehouse_assignments (
  unit text primary key,
  warehouse_id text not null references public.warehouses(id),
  created_at timestamptz not null default now()
);

create table if not exists public.warehouse_inventory (
  warehouse_id text not null references public.warehouses(id),
  material text not null,
  quantity integer not null default 300,
  updated_at timestamptz not null default now(),
  primary key (warehouse_id, material)
);

create table if not exists public.stock_movements (
  id bigint generated always as identity primary key,
  warehouse_id text not null references public.warehouses(id),
  unit text,
  guard_code text,
  material text not null,
  delta integer not null,
  movement_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.guard_submissions (
  id bigint generated always as identity primary key,
  incident_id uuid references public.incidents(id) on delete cascade,
  guard_code text not null,
  unit text not null,
  warehouse text,
  submitted_at timestamptz not null default now(),
  materials jsonb not null default '{}'::jsonb,
  material_delta jsonb not null default '{}'::jsonb
);

create index if not exists guard_submissions_unit_date_idx
  on public.guard_submissions (unit, submitted_at desc);

insert into public.warehouses (id, lot, zone, name, kind) values
  ('lot5_olot_central', 'Lot 5 · Girona - Alt Maresme', 'Olot', 'Olot', 'central'),
  ('lot5_olot_banyoles', 'Lot 5 · Girona - Alt Maresme', 'Olot', 'Banyoles', 'subwarehouse'),
  ('lot5_olot_campdevanol', 'Lot 5 · Girona - Alt Maresme', 'Olot', 'Campdevànol', 'subwarehouse'),
  ('lot5_olot_camprodon', 'Lot 5 · Girona - Alt Maresme', 'Olot', 'Camprodon', 'subwarehouse'),
  ('lot5_olot_sant_joan', 'Lot 5 · Girona - Alt Maresme', 'Olot', 'Sant Joan de les Abadesses', 'subwarehouse')
on conflict (id) do update set
  lot = excluded.lot,
  zone = excluded.zone,
  name = excluded.name,
  kind = excluded.kind;

insert into public.unit_warehouse_assignments (unit, warehouse_id) values
  ('G205', 'lot5_olot_central'),
  ('G450', 'lot5_olot_central'),
  ('G451', 'lot5_olot_central'),
  ('BP52', 'lot5_olot_central'),
  ('Material Supervisor · Olot', 'lot5_olot_central'),
  ('G413', 'lot5_olot_banyoles'),
  ('G215', 'lot5_olot_campdevanol'),
  ('G452', 'lot5_olot_campdevanol'),
  ('G453', 'lot5_olot_camprodon'),
  ('G305', 'lot5_olot_sant_joan')
on conflict (unit) do update set warehouse_id = excluded.warehouse_id;

alter table public.warehouses enable row level security;
alter table public.unit_warehouse_assignments enable row level security;
alter table public.warehouse_inventory enable row level security;
alter table public.stock_movements enable row level security;
alter table public.guard_submissions enable row level security;

drop policy if exists "Authenticated users can read warehouses" on public.warehouses;
create policy "Authenticated users can read warehouses"
  on public.warehouses for select to authenticated using (true);

drop policy if exists "Authenticated users can read assignments" on public.unit_warehouse_assignments;
create policy "Authenticated users can read assignments"
  on public.unit_warehouse_assignments for select to authenticated using (true);

drop policy if exists "Authenticated users can read inventory" on public.warehouse_inventory;
create policy "Authenticated users can read inventory"
  on public.warehouse_inventory for select to authenticated using (true);

drop policy if exists "Authenticated users can read movements" on public.stock_movements;
create policy "Authenticated users can read movements"
  on public.stock_movements for select to authenticated using (true);

drop policy if exists "Authenticated users can read guard submissions" on public.guard_submissions;
create policy "Authenticated users can read guard submissions"
  on public.guard_submissions for select to authenticated using (true);

create or replace function public.initialize_olot_inventory(p_materials jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare inserted_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.warehouse_inventory (warehouse_id, material, quantity)
  select w.id, value #>> '{}', 300
  from public.warehouses w
  cross join jsonb_array_elements(p_materials)
  where w.zone = 'Olot'
  on conflict (warehouse_id, material) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.set_inventory_quantity(
  p_warehouse_id text,
  p_material text,
  p_quantity integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_quantity < 0 then raise exception 'Quantity cannot be negative'; end if;
  perform pg_advisory_xact_lock(
    hashtextextended(p_warehouse_id || ':' || p_material, 1)
  );
  insert into public.warehouse_inventory (warehouse_id, material, quantity, updated_at)
  values (p_warehouse_id, p_material, p_quantity, now())
  on conflict (warehouse_id, material) do update
    set quantity = excluded.quantity, updated_at = now();
  insert into public.stock_movements
    (warehouse_id, material, delta, movement_type)
  values (p_warehouse_id, p_material, 0, 'inventory_adjustment');
end;
$$;

create or replace function public.save_guard_consumption(
  p_incident_code text,
  p_unit text,
  p_warehouse text,
  p_occurred_at timestamptz,
  p_materials jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_warehouse_id text;
  v_incident_id uuid;
  v_old_materials jsonb := '{}'::jsonb;
  v_material text;
  v_old_quantity integer;
  v_new_quantity integer;
  v_difference integer;
  v_delta jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_incident_code !~ '^\d{6}$' then raise exception 'Invalid guard code'; end if;

  select warehouse_id into v_warehouse_id
  from public.unit_warehouse_assignments
  where unit = p_unit;

  perform pg_advisory_xact_lock(hashtextextended(p_unit || ':' || p_incident_code, 0));

  select id, materials into v_incident_id, v_old_materials
  from public.incidents
  where incident_code = p_incident_code and unit = p_unit
  order by created_at desc limit 1
  for update;

  if v_incident_id is null then
    insert into public.incidents
      (incident_code, unit, warehouse, occurred_at, materials)
    values
      (p_incident_code, p_unit, p_warehouse, p_occurred_at, coalesce(p_materials, '{}'::jsonb))
    returning id into v_incident_id;
    v_old_materials := '{}'::jsonb;
  else
    update public.incidents set
      warehouse = p_warehouse,
      occurred_at = p_occurred_at,
      materials = coalesce(p_materials, '{}'::jsonb),
      updated_at = now()
    where id = v_incident_id;
  end if;

  for v_material in
    select key from jsonb_each(coalesce(v_old_materials, '{}'::jsonb))
    union
    select key from jsonb_each(coalesce(p_materials, '{}'::jsonb))
  loop
    v_old_quantity := coalesce((v_old_materials ->> v_material)::integer, 0);
    v_new_quantity := coalesce((p_materials ->> v_material)::integer, 0);
    v_difference := v_new_quantity - v_old_quantity;
    if v_difference <> 0 then
      v_delta := jsonb_set(
        v_delta,
        array[v_material],
        to_jsonb(v_difference),
        true
      );
    end if;
    if v_difference <> 0 and v_warehouse_id is not null then
      perform pg_advisory_xact_lock(
        hashtextextended(v_warehouse_id || ':' || v_material, 1)
      );
      insert into public.warehouse_inventory
        (warehouse_id, material, quantity, updated_at)
      values
        (v_warehouse_id, v_material, 300 - v_difference, now())
      on conflict (warehouse_id, material) do update
        set quantity = public.warehouse_inventory.quantity - v_difference,
            updated_at = now();
      insert into public.stock_movements
        (warehouse_id, unit, guard_code, material, delta, movement_type)
      values
        (v_warehouse_id, p_unit, p_incident_code, v_material, -v_difference, 'guard_consumption');
    end if;
  end loop;

  insert into public.guard_submissions
    (incident_id, guard_code, unit, warehouse, materials, material_delta)
  values
    (v_incident_id, p_incident_code, p_unit, p_warehouse,
     coalesce(p_materials, '{}'::jsonb), v_delta);

  return v_incident_id;
end;
$$;

create or replace function public.receive_central_stock(
  p_warehouse_id text,
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_material text;
  v_quantity integer;
  v_kind text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select kind into v_kind from public.warehouses where id = p_warehouse_id;
  if v_kind is distinct from 'central' then raise exception 'Destination must be a central warehouse'; end if;
  for v_material, v_quantity in
    select key, value::integer
    from jsonb_each_text(coalesce(p_items, '{}'::jsonb))
    order by key
  loop
    if v_quantity <= 0 then continue; end if;
    perform pg_advisory_xact_lock(hashtextextended(p_warehouse_id || ':' || v_material, 1));
    insert into public.warehouse_inventory
      (warehouse_id, material, quantity, updated_at)
    values (p_warehouse_id, v_material, 300 + v_quantity, now())
    on conflict (warehouse_id, material) do update
      set quantity = public.warehouse_inventory.quantity + v_quantity,
          updated_at = now();
    insert into public.stock_movements
      (warehouse_id, material, delta, movement_type)
    values (p_warehouse_id, v_material, v_quantity, 'central_receipt');
  end loop;
end;
$$;

create or replace function public.transfer_stock(
  p_origin_id text,
  p_destination_id text,
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_material text;
  v_quantity integer;
  v_available integer;
  v_origin_kind text;
  v_destination_kind text;
  v_origin_zone text;
  v_destination_zone text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select kind, zone into v_origin_kind, v_origin_zone
  from public.warehouses where id = p_origin_id;
  select kind, zone into v_destination_kind, v_destination_zone
  from public.warehouses where id = p_destination_id;
  if v_origin_kind is distinct from 'central' then raise exception 'Origin must be a central warehouse'; end if;
  if v_destination_kind is distinct from 'subwarehouse' then raise exception 'Destination must be a subwarehouse'; end if;
  if v_origin_zone is distinct from v_destination_zone then raise exception 'Warehouses must belong to the same zone'; end if;

  for v_material, v_quantity in
    select key, value::integer
    from jsonb_each_text(coalesce(p_items, '{}'::jsonb))
    order by key
  loop
    if v_quantity <= 0 then continue; end if;
    perform pg_advisory_xact_lock(hashtextextended(p_origin_id || ':' || v_material, 1));
    perform pg_advisory_xact_lock(hashtextextended(p_destination_id || ':' || v_material, 1));
    select quantity into v_available
    from public.warehouse_inventory
    where warehouse_id = p_origin_id and material = v_material
    for update;
    if coalesce(v_available, 300) < v_quantity then
      raise exception 'Insufficient stock for %', v_material;
    end if;
    insert into public.warehouse_inventory
      (warehouse_id, material, quantity, updated_at)
    values (p_origin_id, v_material, 300 - v_quantity, now())
    on conflict (warehouse_id, material) do update
      set quantity = public.warehouse_inventory.quantity - v_quantity,
          updated_at = now();
    insert into public.warehouse_inventory
      (warehouse_id, material, quantity, updated_at)
    values (p_destination_id, v_material, 300 + v_quantity, now())
    on conflict (warehouse_id, material) do update
      set quantity = public.warehouse_inventory.quantity + v_quantity,
          updated_at = now();
    insert into public.stock_movements
      (warehouse_id, material, delta, movement_type)
    values
      (p_origin_id, v_material, -v_quantity, 'transfer_out'),
      (p_destination_id, v_material, v_quantity, 'transfer_in');
  end loop;
end;
$$;

grant execute on function public.initialize_olot_inventory(jsonb) to authenticated;
grant execute on function public.set_inventory_quantity(text, text, integer) to authenticated;
grant execute on function public.save_guard_consumption(text, text, text, timestamptz, jsonb) to authenticated;
grant execute on function public.receive_central_stock(text, jsonb) to authenticated;
grant execute on function public.transfer_stock(text, text, jsonb) to authenticated;
