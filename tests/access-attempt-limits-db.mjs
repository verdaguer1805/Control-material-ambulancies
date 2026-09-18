// Isolated database only. No real credentials or production writes.
import { PGlite } from '../tmp/warehouse-db-test/node_modules/@electric-sql/pglite/dist/index.js';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const one='00000000-0000-0000-0000-000000000001',two='00000000-0000-0000-0000-000000000002';
await db.exec(`create schema auth; create schema extensions; create schema app_private;
create role anon; create role authenticated;
create table auth.users(id uuid primary key); insert into auth.users values('${one}'),('${two}');
create function auth.uid() returns uuid language sql as $$select current_setting('test.uid')::uuid$$;
set test.uid='${one}';
create function extensions.crypt(text,text) returns text language sql strict as $$select case when $1='12345678' then $2 else 'wrong' end$$;
create table app_private.admin_security(singleton boolean primary key,admin_pin text,owner_code text,updated_at timestamptz);
insert into app_private.admin_security values(true,'1234','test-owner',now());
create function public.verify_admin_pin(input_pin text) returns boolean language sql as $$select input_pin='1234'$$;
create function public.verify_owner_code(input_owner_code text) returns boolean language sql as $$select input_owner_code='test-owner'$$;
create function public.stage_admin_access_code(input_owner_code text,p_access_key text,p_code text) returns boolean language plpgsql as $$begin
if not public.verify_owner_code(input_owner_code) then raise exception 'OWNER_AUTHORIZATION_REQUIRED'; end if;
return true; end$$;`);
let base=read('../supabase_device_security.sql');
await db.exec(base.slice(base.indexOf('create table'),base.indexOf('create or replace function public.is_device_authorized')));
await db.exec(read('../sql/harden-device-activation.sql'));
base=read('../supabase_admin_roles.sql');
await db.exec(base.slice(base.indexOf('create table'),base.indexOf('create table if not exists public.unit_supervision_zones')));
await db.exec(`create function public.current_admin_access() returns jsonb language sql as $$select jsonb_build_object('authorized',true,'role','owner')$$;
insert into app_private.admin_access_codes values('owner','owner',null,'fixture',now());
update public.app_security_config set enforcement_enabled=true,authorization_version=1,activation_code_hash='fixture';`);
await db.exec(base.slice(base.indexOf('create or replace function public.open_admin_access_session'),base.indexOf('create or replace function public.close_admin_access_session')));
await db.exec(`select public.activate_device('12345678','G453','lot5');`);
const before=(await db.query('select to_jsonb(d) as d from public.device_authorizations d')).rows;
const migration=read('../sql/access-attempt-limits.sql');
await db.exec(migration); await db.exec(migration);
const call=async(scope,good=false)=>{
  const sql={activation:`select public.activate_device($1,'G453','lot5') as r`,admin:`select public.open_admin_access_session($1) as r`,
    owner:`select public.verify_owner_code($1) as r`,unit_pin:`select public.verify_admin_pin($1) as r`}[scope];
  const code=good?({activation:'12345678',admin:'12345678',owner:'test-owner',unit_pin:'1234'}[scope]):'wrong';
  return (await db.query(sql,[code])).rows[0].r;
};
const status=async scope=>(await db.query('select public.get_access_attempt_status($1) as r',[scope])).rows[0].r;
const expire=async scope=>db.query(`update app_private.access_attempt_limits set blocked_until=clock_timestamp()-interval '1 second' where user_id=auth.uid() and scope=$1`,[scope]);
for(const scope of ['activation','admin','owner','unit_pin']) {
  for(let cycle=1;cycle<=5;cycle++) {
    await call(scope); assert.equal((await status(scope)).attempts_remaining,2);
    await call(scope); assert.equal((await status(scope)).attempts_remaining,1);
    await call(scope); const s=await status(scope);
    assert.equal(s.failed_cycles,cycle);
    assert.ok(s.retry_after_seconds>(cycle===5?3590:170));
    const locked=s.blocked_until;
    const blocked=await call(scope,true);
    assert.equal(typeof blocked==='boolean'?blocked:blocked.authorized,false);
    assert.equal((await status(scope)).blocked_until,locked,'retries do not extend lock');
    await expire(scope);
  }
  assert.equal((await call(scope,true))?.authorized ?? (scope==='owner'||scope==='unit_pin'),true);
  assert.equal((await status(scope)).failed_cycles,0);
}
// Boolean wrappers must persist failures through legacy owner callers too.
for(let i=0;i<3;i++) assert.equal((await db.query("select public.stage_admin_access_code('wrong','owner','x') as r")).rows[0].r,null);
assert.ok((await status('owner')).retry_after_seconds>170);
// The block does not revoke the existing device or administrator session.
const identity=rows=>rows.map(({d})=>({user_id:d.user_id,unit:d.unit,lot:d.lot,active:d.active,version:d.authorization_version}));
assert.deepEqual(identity((await db.query('select to_jsonb(d) as d from public.device_authorizations d')).rows),identity(before));
await db.exec(`set test.uid='${two}'`);
assert.equal((await status('owner')).retry_after_seconds,0,'another identity is not blocked');
assert.equal(await call('unit_pin',true),true);
assert.equal((await db.query("select has_function_privilege('authenticated','app_private.check_access_attempt(text,text,text,text)','EXECUTE') as allowed")).rows[0].allowed,false);
await db.close();
console.log('PASS: all 4 scopes; 3 failures/3 minutes; fifth cycle/1 hour; success reset; legacy callers persist; other identities isolated; private helpers inaccessible.');
