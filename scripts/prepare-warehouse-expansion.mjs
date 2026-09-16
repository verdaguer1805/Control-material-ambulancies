import { writeFileSync, readFileSync } from 'node:fs';
import { STAGED_WAREHOUSE_DEPLOYMENTS as configs } from '../src/warehouse-expansion.mjs';
import { MATERIALS } from '../src/data.js';

const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const warehouses = configs.flatMap(c => c.warehouses.map(w => `(${[w.id,c.lot,c.zone,w.name,w.kind].map(quote).join(',')},${w.unitCount})`));
const assignments = configs.flatMap(c => Object.entries(c.unitAssignments).map(([u,w]) => `(${quote(u)},${quote(w)})`));
const sql = `-- PREPARED FOR REVIEW ONLY. Not executed by the app.
-- Execute first against an isolated copy of production; activation requires review.
begin;
select pg_advisory_xact_lock(hashtextextended('lot5-warehouse-expansion-v1',0));
create temporary table expansion_warehouses(id text primary key, lot text, zone text, name text, kind text, unit_count integer) on commit drop;
insert into expansion_warehouses values
${warehouses.join(',\n')};
create temporary table expansion_assignments(unit text primary key, warehouse_id text) on commit drop;
insert into expansion_assignments values
${assignments.join(',\n')};
create temporary table expansion_materials(material text primary key) on commit drop;
insert into expansion_materials values
${MATERIALS.map(m=>`(${quote(m)})`).join(',\n')};

-- Fail on conflicting existing configuration. Never reassign a unit silently.
do $$ begin
  if exists(select 1 from expansion_warehouses e join public.warehouses w using(id)
    where (w.lot,w.zone,w.name,w.kind) is distinct from (e.lot,e.zone,e.name,e.kind)) then
    raise exception 'EXISTING_WAREHOUSE_CONFLICT';
  end if;
  if exists(select 1 from expansion_assignments e join public.unit_warehouse_assignments a using(unit)
    where a.warehouse_id <> e.warehouse_id) then raise exception 'EXISTING_ASSIGNMENT_CONFLICT'; end if;
  if exists(select 1 from expansion_materials m left join public.warehouse_inventory i
    on i.material=m.material and i.warehouse_id='lot5_olot_camprodon'
    where i.minimum_quantity is null or i.minimum_quantity < 0) then
    raise exception 'MISSING_CAMPRODON_MINIMUM';
  end if;
end $$;

-- Keep the approved unit weights and initial one-ambulance minimum snapshot.
create table if not exists public.expansion_warehouse_weights (
  warehouse_id text primary key references public.warehouses(id),
  unit_count integer not null check(unit_count >= 0)
);
create table if not exists public.expansion_material_baselines (
  material text primary key, minimum_quantity integer not null check(minimum_quantity >= 0)
);
alter table public.expansion_warehouse_weights enable row level security;
alter table public.expansion_material_baselines enable row level security;
revoke all on public.expansion_warehouse_weights, public.expansion_material_baselines from public, anon, authenticated;

insert into public.warehouses(id,lot,zone,name,kind)
select id,lot,zone,name,kind from expansion_warehouses on conflict(id) do nothing;
insert into public.expansion_warehouse_weights
select id,unit_count from expansion_warehouses on conflict(warehouse_id) do nothing;
insert into public.expansion_material_baselines
select m.material,i.minimum_quantity from expansion_materials m join public.warehouse_inventory i
on i.material=m.material and i.warehouse_id='lot5_olot_camprodon' on conflict(material) do nothing;

-- One-time inventory insertion: never overwrite existing quantities or minimums.
insert into public.warehouse_inventory(warehouse_id,material,quantity,minimum_quantity,minimum_base_quantity,safety_percentage)
select w.id,m.material,1000,
  case when w.kind='central' then ceil(b.minimum_quantity * (select sum(e.unit_count) from expansion_warehouses e where e.zone=w.zone) * 1.30)::integer
       else b.minimum_quantity*w.unit_count end,
  case when w.kind='central' then b.minimum_quantity * (select sum(e.unit_count) from expansion_warehouses e where e.zone=w.zone)::integer
       else b.minimum_quantity*w.unit_count end,30
from expansion_warehouses w cross join expansion_materials m join public.expansion_material_baselines b on b.material=m.material
on conflict(warehouse_id,material) do nothing;

insert into public.unit_warehouse_assignments(unit,warehouse_id)
select unit,warehouse_id from expansion_assignments on conflict(unit) do nothing;
` + readFileSync(new URL('../sql/warehouse-expansion-functions.sql', import.meta.url),'utf8') + '\ncommit;\n';
writeFileSync(new URL('../docs/warehouse-expansion-review.sql', import.meta.url), sql);
writeFileSync(new URL('../docs/warehouse-expansion-plan.json', import.meta.url), JSON.stringify({materials: MATERIALS.length, deployments:configs},null,2)+'\n');
console.log(`Prepared ${warehouses.length} warehouses, ${assignments.length} assignments and ${MATERIALS.length} materials. No database connection used.`);
