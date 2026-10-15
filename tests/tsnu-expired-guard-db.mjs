// Isolated PostgreSQL regression test: never connects to production.
import {PGlite} from '../tmp/warehouse-db-test/node_modules/@electric-sql/pglite/dist/index.js';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {TSNU_CHECKLIST_ITEMS} from '../src/checklist-demo.mjs';
const db=new PGlite(),user='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const lot='Lot 5 · Girona - Alt Maresme';
try {
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key);insert into auth.users values('${user}'),('${other}');
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table app_security_config(singleton boolean primary key,authorization_version int);insert into app_security_config values(true,1);
 create table device_authorizations(user_id uuid primary key,unit text,lot text,active boolean,authorization_version int,last_seen_at timestamptz);
 create table warehouses(id text primary key,lot text,zone text,name text,kind text);
 insert into warehouses values('lot5_olot_central','${lot}','Olot','Olot','central'),('lot5_olot_campdevanol','${lot}','Olot','Campdevànol','subwarehouse');
 create table warehouse_inventory(warehouse_id text,material text,quantity int,pending_replenishment int default 0,updated_at timestamptz,primary key(warehouse_id,material));
 create table stock_movements(id bigint generated always as identity primary key,warehouse_id text,unit text,guard_code text,material text,delta int,movement_type text,created_at timestamptz default now());
 create function verify_admin_pin(text) returns boolean language sql as $$select false$$;
 insert into device_authorizations values('${user}','T1731','${lot}',true,1,now());
 insert into warehouse_inventory values('lot5_olot_campdevanol','Gasas',20,0,now());
 select set_config('test.uid','${user}',false);`);
 for(const file of ['tsnu-production-v1.sql','tsnu-close-source-v1.sql','tsnu-expired-guard-close-v1.sql'])
   await db.exec(fs.readFileSync(new URL(`../sql/${file}`,import.meta.url),'utf8'));
 const when=(await db.query(`select now()-interval '3 days' as old,now()-interval '2 days' as yesterday,now() as current`)).rows[0];
 await db.query('select start_tsnu_shift($1,$2)',[id(1),when.old]);
 await db.query(`select finish_tsnu_shift_v2($1,now(),'automatic')`,[id(1)]);
 let closed=(await db.query('select * from tsnu_shift_sessions where id=$1',[id(1)])).rows[0];
 assert.equal(closed.close_source,'automatic');assert.equal(closed.checklist_submitted_at,null);assert.equal(closed.checklist_answers,null);
 assert.equal((await db.query(`select (ended_at at time zone 'Europe/Madrid')::time::text as time from tsnu_shift_sessions where id=$1`,[id(1)])).rows[0].time,'00:00:00');
 await db.query(`select finish_tsnu_shift_v2($1,now(),'automatic')`,[id(1)]);
 // Missing local finish: opening the next day repairs only the expired session.
 await db.query('select start_tsnu_shift($1,$2)',[id(2),when.yesterday]);
 await db.query('select start_tsnu_shift($1,$2)',[id(3),when.current]);
 closed=(await db.query('select * from tsnu_shift_sessions where id=$1',[id(2)])).rows[0];
 assert.equal(closed.close_source,'automatic');assert.equal(closed.checklist_submitted_at,null);
 await db.query('select start_tsnu_shift($1,$2)',[id(3),when.current]);
 await assert.rejects(db.query('select start_tsnu_shift($1,$2)',[id(4),when.current]),/OPEN_SHIFT_EXISTS/);
 await assert.rejects(db.query(`select finish_tsnu_shift_v2($1,now(),'manual')`,[id(3)]),/CHECKLIST_REQUIRED/);
 await assert.rejects(db.query(`select finish_tsnu_shift_v2($1,now(),'automatic')`,[id(3)]),/INVALID_END_TIME/);
 // The scope check remains enforced; an unrelated user cannot close a session.
 await db.exec(`select set_config('test.uid','${other}',false)`);
 await assert.rejects(db.query(`select finish_tsnu_shift_v2($1,now(),'automatic')`,[id(3)]),/INVALID_SHIFT/);
 await db.exec(`select set_config('test.uid','${user}',false)`);
 assert.equal((await db.query('select count(*)::int n from stock_movements')).rows[0].n,0);
 assert.equal((await db.query("select quantity from warehouse_inventory where material='Gasas'")).rows[0].quantity,20);
 // Completed guards retain their checklist and idempotent withdrawals.
 const answers=Object.fromEntries(TSNU_CHECKLIST_ITEMS.map(item=>[item,'ok']));
 await db.query('select submit_tsnu_checklist($1,$2::jsonb)',[id(3),JSON.stringify(answers)]);
 await db.query('select append_tsnu_withdrawal($1,$2,$3::jsonb)',[id(10),id(3),'{"Gasas":3}']);
 await db.query('select append_tsnu_withdrawal($1,$2,$3::jsonb)',[id(10),id(3),'{"Gasas":3}']);
 await db.query(`select finish_tsnu_shift_v2($1,now(),'manual')`,[id(3)]);
 assert.equal((await db.query("select quantity from warehouse_inventory where material='Gasas'")).rows[0].quantity,17);
 assert.equal((await db.query('select count(*)::int n from stock_movements')).rows[0].n,1);
 // A completed but unclosed older session is also safe to roll over.
 await db.query('select start_tsnu_shift($1,$2)',[id(5),when.old]);
 await db.query('select submit_tsnu_checklist($1,$2::jsonb)',[id(5),JSON.stringify(answers)]);
 await db.query('select start_tsnu_shift($1,$2)',[id(6),when.current]);
 const completedOld=(await db.query('select * from tsnu_shift_sessions where id=$1',[id(5)])).rows[0];
 assert.equal(completedOld.close_source,'automatic');assert.ok(completedOld.checklist_submitted_at);
 assert.deepEqual(completedOld.checklist_answers,answers);
 assert.equal((await db.query('select count(*)::int n from stock_movements')).rows[0].n,1);
 console.log('TSNU expired guard database regression tests passed');
} catch(error) {console.error(error.message);process.exitCode=1;} finally {await db.close();}
