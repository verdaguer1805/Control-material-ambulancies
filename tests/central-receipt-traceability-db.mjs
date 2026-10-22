// Isolated database; never connects to production.
import {PGlite} from '../tmp/warehouse-db-test/node_modules/@electric-sql/pglite/dist/index.js';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();
const actor='00000000-0000-4000-8000-000000000001';
try{
 await db.exec(`create schema auth;
 create function auth.uid() returns uuid language sql as $$select current_setting('test.uid',true)::uuid$$;
 create table warehouses(id text primary key,kind text,zone text);
 create table admin_access_sessions(user_id uuid primary key,role text,zone text,expires_at timestamptz);
 create table warehouse_inventory(warehouse_id text,material text,quantity integer not null default 300,updated_at timestamptz,primary key(warehouse_id,material));
 create table stock_movements(id bigint generated always as identity,warehouse_id text,material text,delta integer,movement_type text,operation_id uuid,performed_role text,performed_zone text,actor_user_id uuid);
 create function require_admin_warehouse(text) returns void language plpgsql as $$begin
 if not exists(select 1 from public.admin_access_sessions s join public.warehouses w on w.id=$1 where s.user_id=auth.uid() and s.expires_at>now() and (s.role='owner' or s.zone=w.zone)) then raise exception 'ADMIN_ZONE_ACCESS_DENIED'; end if; end$$;
 insert into warehouses values('central-a','central','A'),('central-b','central','B'),('sub-a','subwarehouse','A');
 insert into admin_access_sessions values('${actor}','owner',null,now()+interval '1 hour');
 select set_config('test.uid','${actor}',false);
 insert into warehouse_inventory values('central-a','Existing zero',0,now()),('central-a','Existing positive',12,now());`);
 await db.exec(fs.readFileSync(new URL('../sql/central-receipt-traceability-v1.sql',import.meta.url),'utf8'));
 const receive=items=>db.query('select receive_central_stock_role_impl($1,$2::jsonb)',['central-a',JSON.stringify(items)]);
 await receive({'New material':10,'Existing zero':10,'Existing positive':10});
 const inventory=(await db.query('select material,quantity from warehouse_inventory order by material')).rows;
 assert.deepEqual(inventory,[{material:'Existing positive',quantity:22},{material:'Existing zero',quantity:10},{material:'New material',quantity:10}]);
 const movements=(await db.query('select * from stock_movements')).rows;
 assert.equal(movements.length,3);assert.equal(new Set(movements.map(m=>m.operation_id)).size,1);
 for(const m of movements){assert.equal(m.performed_role,'owner');assert.equal(m.actor_user_id,actor);assert.equal(m.delta,10);}
 await receive({'New material':2});assert.equal((await db.query("select quantity from warehouse_inventory where material='New material'")).rows[0].quantity,12);
 for(const role of ['supervisor','logistics']){
  await db.query('update admin_access_sessions set role=$1,zone=$2',[role,'A']);
  await receive({[role]:1});
  const row=(await db.query('select * from stock_movements where material=$1',[role])).rows[0];assert.equal(row.performed_role,role);assert.equal(row.performed_zone,'A');
  await assert.rejects(db.query("select receive_central_stock_role_impl('central-b','{\"No access\":1}')"),/ADMIN_ZONE_ACCESS_DENIED/);
 }
 for(const invalid of [{bad:-1},{bad:1.5},{bad:null},{bad:2147483648},['bad'],null])await assert.rejects(receive(invalid),/INVALID_QUANTITY/);
 await assert.rejects(db.query("select receive_central_stock_role_impl('sub-a','{\"Not central\":1}')"),/central warehouse/);
 await db.exec("insert into warehouse_inventory(warehouse_id,material) values('central-a','Default zero')");
 assert.equal((await db.query("select quantity from warehouse_inventory where material='Default zero'")).rows[0].quantity,0);
 await db.exec("update admin_access_sessions set expires_at=now()-interval '1 second'");
 await assert.rejects(receive({Expired:1}),/ADMIN_ZONE_ACCESS_DENIED/);
 assert.equal((await db.query("select count(*)::int n from stock_movements where material in ('bad','No access','Not central','Expired')")).rows[0].n,0);
 console.log('PASS: exact quantities at zero/new/existing stock; global role/actor tracing; access and invalid-input rollback; zero default.');
}finally{await db.close();}
