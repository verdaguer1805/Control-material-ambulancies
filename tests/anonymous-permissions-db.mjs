// Isolated database only. No production credentials or writes.
import { PGlite } from '../tmp/warehouse-db-test/node_modules/@electric-sql/pglite/dist/index.js';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const db = new PGlite();
const migration = readFileSync(new URL('../sql/harden-anonymous-permissions.sql', import.meta.url), 'utf8');
const tables = [
  'backup_banyoles_incidents_pre_20260911',
  'backup_banyoles_movements_pre_20260911',
  'backup_banyoles_submissions_pre_20260911',
  'guard_submissions', 'incidents', 'profiles', 'stock_movements',
  'unit_warehouse_assignments', 'warehouse_inventory', 'warehouses',
];

await db.exec('create role anon; create role authenticated;');
for (const table of tables) {
  await db.exec(`create table public.${table}(id integer); insert into public.${table} values (1); grant all on public.${table} to anon, authenticated;`);
}
await db.exec(`
create function public.get_database_usage() returns integer language sql as $$select 1$$;
create function public.recalculate_olot_central_minimum(text) returns void language sql as $$select$$;
create function public.recalculate_olot_central_minimum_trigger() returns trigger language plpgsql as $$begin return new; end$$;
create function public.track_pending_replenishment() returns trigger language plpgsql as $$begin return new; end$$;
grant execute on function public.get_database_usage() to anon, authenticated;
grant execute on function public.recalculate_olot_central_minimum(text) to anon, authenticated;
grant execute on function public.recalculate_olot_central_minimum_trigger() to anon, authenticated;
grant execute on function public.track_pending_replenishment() to anon, authenticated;
`);

await db.exec(migration);
await db.exec(migration);

for (const table of tables) {
  const result = (await db.query(`select
    has_table_privilege('anon','public.${table}','SELECT') as anon_select,
    has_table_privilege('anon','public.${table}','INSERT') as anon_insert,
    has_table_privilege('authenticated','public.${table}','SELECT') as auth_select,
    (select count(*) from public.${table}) as rows_preserved`)).rows[0];
  assert.equal(result.anon_select, false, `${table}: anon SELECT removed`);
  assert.equal(result.anon_insert, false, `${table}: anon INSERT removed`);
  assert.equal(result.auth_select, true, `${table}: authenticated preserved`);
  assert.equal(Number(result.rows_preserved), 1, `${table}: data preserved`);
}

assert.equal((await db.query("select has_function_privilege('anon','public.get_database_usage()','EXECUTE') as v")).rows[0].v, false);
assert.equal((await db.query("select has_function_privilege('authenticated','public.get_database_usage()','EXECUTE') as v")).rows[0].v, true);
for (const signature of [
  'public.recalculate_olot_central_minimum(text)',
  'public.recalculate_olot_central_minimum_trigger()',
  'public.track_pending_replenishment()',
]) {
  assert.equal((await db.query(`select has_function_privilege('anon','${signature}','EXECUTE') as v`)).rows[0].v, false);
  assert.equal((await db.query(`select has_function_privilege('authenticated','${signature}','EXECUTE') as v`)).rows[0].v, false);
}

await db.close();
console.log('PASS: anonymous table grants removed; authenticated app access and all data preserved; internal functions closed.');
