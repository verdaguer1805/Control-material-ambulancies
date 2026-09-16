// Isolated PostgreSQL test. Install @electric-sql/pglite under tmp/warehouse-db-test.
import { PGlite } from '../tmp/warehouse-db-test/node_modules/@electric-sql/pglite/dist/index.js';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { MATERIALS } from '../src/data.js';
const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated;
    create table warehouses(id text primary key,lot text,zone text,name text,kind text);
    create table unit_warehouse_assignments(unit text primary key,warehouse_id text references warehouses);
    create table warehouse_inventory(warehouse_id text references warehouses,material text,quantity integer,
      minimum_quantity integer,minimum_base_quantity integer,safety_percentage integer,updated_at timestamptz default now(),primary key(warehouse_id,material));
    create function admin_has_role(text[]) returns boolean language sql as 'select current_setting(''test.allowed'',true) = ''yes''';
    create function require_admin_warehouse(text) returns void language plpgsql as 'begin return; end';
    insert into warehouses values('lot5_olot_camprodon','Lot 5 · Girona - Alt Maresme','Olot','Camprodon','subwarehouse');
    set test.allowed='yes';`);
  for (const material of MATERIALS) await db.query('insert into warehouse_inventory values($1,$2,17,3,3,30,now())',['lot5_olot_camprodon',material]);
  const original = (await db.query("select * from warehouse_inventory where warehouse_id='lot5_olot_camprodon' order by material")).rows;
  const sql = readFileSync(new URL('../docs/warehouse-expansion-review.sql',import.meta.url),'utf8');
  await db.exec(sql);
  assert.equal((await db.query("select count(*)::integer n from warehouse_inventory where warehouse_id<>'lot5_olot_camprodon'")).rows[0].n,31*MATERIALS.length);
  const material=MATERIALS[0];
  let central=(await db.query("select * from warehouse_inventory where warehouse_id='lot5_figueres_central' and material=$1",[material])).rows[0];
  assert.equal(central.minimum_quantity,71);
  await db.query("update warehouse_inventory set quantity=42,minimum_quantity=10 where warehouse_id='lot5_figueres_cadaques' and material=$1",[material]);
  central=(await db.query("select * from warehouse_inventory where warehouse_id='lot5_figueres_central' and material=$1",[material])).rows[0];
  assert.equal(central.minimum_base_quantity,61);
  assert.equal(central.minimum_quantity,80);
  await db.query("select set_expansion_safety_percentages('lot5_figueres_central',$1::jsonb)",[JSON.stringify({[material]:50})]);
  assert.equal((await db.query("select minimum_quantity from warehouse_inventory where warehouse_id='lot5_figueres_central' and material=$1",[material])).rows[0].minimum_quantity,92);
  const before=(await db.query('select * from warehouse_inventory order by warehouse_id,material')).rows;
  await db.exec(sql);
  assert.deepEqual((await db.query('select * from warehouse_inventory order by warehouse_id,material')).rows,before);
  assert.deepEqual((await db.query("select * from warehouse_inventory where warehouse_id='lot5_olot_camprodon' order by material")).rows,original);
  await db.exec("set test.allowed='no'");
  await assert.rejects(db.query("select set_expansion_safety_percentages('lot5_figueres_central',$1::jsonb)",[JSON.stringify({[material]:30})]),/ADMIN_ROLE_ACCESS_DENIED/);
  await db.exec("set test.allowed='yes'");
  await assert.rejects(db.query("select set_expansion_safety_percentages('lot5_olot_camprodon',$1::jsonb)",[JSON.stringify({[material]:30})]),/SAFETY_PERCENTAGE_ONLY_EXPANSION_CENTRAL/);
  console.log('PASS: 4,495 new inventory rows; minimum recalculation; safety adjustment; repeat preserves all stock; Olot unchanged; role rejection; Olot rejection. Auth helpers mocked; production RLS not tested.');
} finally { await db.close(); }
