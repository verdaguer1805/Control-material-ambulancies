import { PGlite } from '../tmp/warehouse-db-test/node_modules/@electric-sql/pglite/dist/index.js';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
await db.exec(`create schema auth; create schema extensions;
create table auth.users(id uuid primary key);
insert into auth.users values('00000000-0000-0000-0000-000000000001');
create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
create function extensions.crypt(text,text) returns text language sql strict as $$select case when $1='12345678' then $2 else 'wrong' end$$;
create role anon; create role authenticated;`);
const base=readFileSync(new URL('../supabase_device_security.sql',import.meta.url),'utf8');
await db.exec(base.slice(base.indexOf('create table'),base.indexOf('create or replace function public.is_device_authorized')));
await db.exec(`update public.app_security_config set enforcement_enabled=true,authorization_version=1,activation_code_hash='fixture';`);
const migration=readFileSync(new URL('../sql/harden-device-activation.sql',import.meta.url),'utf8');
await db.exec(migration);
await db.exec(migration); // safe to rerun
for(const code of [null,'','123','abcdefgh','00000000','1234567890123']) {
  await assert.rejects(db.query('select public.activate_device($1,$2,$3)',[code,'G453','lot5']),/INVALID_DEVICE_ACTIVATION_CODE/);
}
assert.equal((await db.query('select count(*)::int n from public.device_authorizations')).rows[0].n,0);
await db.query('select public.activate_device($1,$2,$3)',['12345678','G453','lot5']);
assert.equal((await db.query('select count(*)::int n from public.device_authorizations')).rows[0].n,1);
await db.exec(migration);
assert.equal((await db.query('select count(*)::int n from public.device_authorizations')).rows[0].n,1);
await db.close();
console.log('PASS: missing/invalid codes rejected; valid code works; existing authorization preserved.');
