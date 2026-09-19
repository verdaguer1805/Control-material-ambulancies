// Isolated PostgreSQL test. It never connects to production Supabase.
import {PGlite} from '../tmp/warehouse-db-test/node_modules/@electric-sql/pglite/dist/index.js';
import fs from 'node:fs';import assert from 'node:assert/strict';
const db=new PGlite(), user='00000000-0000-4000-8000-000000000001', shift='10000000-0000-4000-8000-000000000001', op='20000000-0000-4000-8000-000000000001';
const lot='Lot 5 · Girona - Alt Maresme';
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${user}');
 create function auth.uid() returns uuid language sql as $$select current_setting('test.uid',true)::uuid$$;
 create table app_security_config(singleton boolean primary key,authorization_version int);insert into app_security_config values(true,1);
 create table device_authorizations(user_id uuid primary key,device_id text,unit text,lot text,active boolean,authorization_version int,activated_at timestamptz,last_seen_at timestamptz);
 create table warehouses(id text primary key,lot text,zone text,name text,kind text);insert into warehouses values('lot5_olot_central','${lot}','Olot','Olot','central'),('lot5_olot_campdevanol','${lot}','Olot','Campdevànol','subwarehouse');
 create table warehouse_inventory(warehouse_id text references warehouses,material text,quantity int,pending_replenishment int default 0,updated_at timestamptz,primary key(warehouse_id,material));
 create table stock_movements(id bigint generated always as identity primary key,warehouse_id text references warehouses,unit text,guard_code text,material text,delta int,movement_type text,created_at timestamptz default now());
 create function verify_admin_pin(text) returns boolean language sql security definer as $$select $1='secret'$$;
 insert into device_authorizations values('${user}','d','T1731','${lot}',true,1,now(),now());insert into warehouse_inventory values('lot5_olot_campdevanol','Gasas',20,0,now());
 select set_config('test.uid','${user}',false);`);
 await db.exec(fs.readFileSync(new URL('../sql/tsnu-production-v1.sql',import.meta.url),'utf8'));
 const answers={};for(const item of ['Maleta de intervención precintada','DEA','Mantas de un solo uso','Sabanas de un solo uso','Contenedor de agujas grande','Bolsas de vómito','Sonda de aspiración','Aspirador manual','Empapadores','Cuña de hombre','Cuña de mujer','Bata EPI o mono de protección','Bolsas de residuos GII','Bolsas de basura negras','Gafas de protección EPI','Guantes de protección EPI','Oxígeno disponible y con carga suficiente','Guantes de nitrilo de diferentes tallas','Cadenas de nieve','Cizallas','Pata de cabra','Tarjeta de gasóleo','Tarjeta Trueta'])answers[item]='ok';
 await db.query('select start_tsnu_shift($1,now())',[shift]);await db.query('select submit_tsnu_checklist($1,$2::jsonb)',[shift,JSON.stringify(answers)]);
 await db.query('select append_tsnu_withdrawal($1,$2,$3::jsonb)',[op,shift,'{"Gasas":3}']);await db.query('select append_tsnu_withdrawal($1,$2,$3::jsonb)',[op,shift,'{"Gasas":3}']);
 const stock=(await db.query("select quantity,pending_replenishment from warehouse_inventory where material='Gasas'")).rows[0];assert.deepEqual(stock,{quantity:17,pending_replenishment:3});
 assert.equal((await db.query('select count(*)::int n from tsnu_withdrawals')).rows[0].n,1);assert.equal((await db.query('select count(*)::int n from stock_movements')).rows[0].n,1);
 await db.query('select finish_tsnu_shift($1,now())',[shift]);await assert.rejects(db.query('select append_tsnu_withdrawal(gen_random_uuid(),$1,$2::jsonb)',[shift,'{"Gasas":1}']),/INVALID_OPEN_SHIFT/);
 console.log('TSNU production database tests passed');
}finally{await db.close();}
