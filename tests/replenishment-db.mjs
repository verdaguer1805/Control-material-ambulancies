// Isolated PostgreSQL-compatible test. Never connects to live stock.
import {PGlite} from '../tmp/warehouse-db-test/node_modules/@electric-sql/pglite/dist/index.js';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const db=new PGlite(),actor=randomUUID();
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql as $$select current_setting('test.uid',true)::uuid$$;
 create table warehouses(id text primary key,kind text,zone text,lot text);
 create table admin_access_sessions(user_id uuid primary key,role text,zone text,lot text,expires_at timestamptz);
 create table warehouse_inventory(warehouse_id text,material text,quantity integer default 300,updated_at timestamptz,pending_replenishment integer default 0,primary key(warehouse_id,material));
 create table stock_movements(id bigint generated always as identity,warehouse_id text,material text,delta integer,movement_type text,operation_id uuid,performed_role text,performed_zone text,actor_user_id uuid);
 create function require_admin_warehouse(text) returns void language plpgsql as $$begin
 if not exists(select 1 from public.admin_access_sessions s join public.warehouses w on w.id=$1 where s.user_id=auth.uid() and s.expires_at>now() and (s.role in ('owner','logistics') or (s.role='supervisor' and s.zone=w.zone and s.lot=w.lot))) then raise exception 'ADMIN_ZONE_ACCESS_DENIED'; end if;end$$;
 insert into warehouses values('a','central','A','L1'),('as','subwarehouse','A','L1'),('b','central','B','L1'),('bs','subwarehouse','B','L1'),('a2','central','A','L2');
 insert into admin_access_sessions values('${actor}','owner',null,null,now()+interval '1 hour');
 select set_config('test.uid','${actor}',false);
 insert into warehouse_inventory(warehouse_id,material,quantity) values('a','Gasas',60),('a','Bolsas',10),('b','Gasas',60),('a2','Gasas',60);`);
 await db.exec(fs.readFileSync('sql/central-receipt-traceability-v1.sql','utf8'));
 await db.exec(`create function public.receive_central_stock(text,jsonb) returns void language plpgsql as $$begin perform public.receive_central_stock_role_impl($1,$2);end$$;`);
 const transfers=fs.readFileSync('supabase_recorded_stock_transfers.sql','utf8');
 await db.exec(transfers.slice(0,transfers.indexOf('drop policy')));
 await db.exec(fs.readFileSync('supabase_pending_replenishment.sql','utf8'));
 const migration=fs.readFileSync('sql/warehouse-replenishment-v1.sql','utf8');
 await db.exec(migration);await db.exec(migration);
 const send=(id,origin,destination,items,lot='L1',zone='A')=>db.query('select confirm_warehouse_replenishment($1,$2,$3,$4,$5,$6::jsonb) as receipt',[id,lot,zone,origin,destination,JSON.stringify(items)]);
 const qty=async(id,m='Gasas')=>(await db.query('select quantity from warehouse_inventory where warehouse_id=$1 and material=$2',[id,m])).rows[0]?.quantity;
 const id=randomUUID();const first=await send(id,'a','as',{Gasas:3,Bolsas:2});
 assert.deepEqual(await send(id,'a','as',{Bolsas:2,Gasas:3}),first); // JSONB key order does not matter.
 assert.equal(await qty('a'),57);assert.equal(await qty('as'),3); // Missing destination starts at zero, not 300.
 assert.equal((await db.query('select count(*)::int n from stock_movements')).rows[0].n,4);
 await assert.rejects(send(id,'a','as',{Gasas:4}),/REQUEST_CONFLICT/);
 const receiptId=randomUUID();await send(receiptId,null,'a',{Gasas:60});await send(receiptId,null,'a',{Gasas:60});
 assert.equal(await qty('a'),117);
 const failed=randomUUID();await assert.rejects(send(failed,'a','as',{Gasas:200,Bolsas:1}),/Insufficient stock/);
 assert.equal(await qty('a','Bolsas'),8); // Whole transaction rolled back.
 await send(failed,'a','as',{Gasas:1}); // A rejected transaction is safe to edit.
 for(const items of [{Gasas:0},{Gasas:-1},{Gasas:1.2},{Gasas:'2'},{Gasas:null},{Gasas:2147483648},{}])await assert.rejects(send(randomUUID(),null,'a',items),/INVALID/);
 await assert.rejects(send(randomUUID(),null,'a',{Unknown:1}),/UNKNOWN_MATERIAL/);
 await assert.rejects(send(randomUUID(),'a','bs',{Gasas:1}),/INVALID_SCOPE/);
 await assert.rejects(send(randomUUID(),'a2','as',{Gasas:1}),/INVALID_TRANSFER/);
 await assert.rejects(send(randomUUID(),null,'as',{Gasas:1}),/INVALID_DESTINATION/);
 await db.exec("update admin_access_sessions set role='supervisor',zone='A',lot='L1'");
 await send(randomUUID(),'a','as',{Gasas:1});
 await assert.rejects(send(randomUUID(),null,'b',{Gasas:1},'L1','B'),/ACCESS_DENIED/);
 await assert.rejects(send(randomUUID(),null,'a2',{Gasas:1},'L2','A'),/ACCESS_DENIED/);
 await db.exec("update admin_access_sessions set role='logistics'");await send(randomUUID(),null,'b',{Gasas:1},'L1','B');
 await db.exec("update admin_access_sessions set role='reports_viewer'");await assert.rejects(send(randomUUID(),null,'a',{Gasas:1}),/ACCESS_DENIED/);
 await db.exec("update admin_access_sessions set role='owner',expires_at=now()-interval '1 minute'");await assert.rejects(send(id,'a','as',{Gasas:3,Bolsas:2}),/ACCESS_DENIED/);
 console.log('PASS: idempotent migration/receipts/transfers, atomic failure, zero initialization, role/lot/zone isolation, invalid quantities and replay conflicts.');
}finally{await db.close();}
