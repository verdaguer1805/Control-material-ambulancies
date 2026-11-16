// Isolated PostgreSQL only. No production connection.
import {PGlite} from '../tmp/warehouse-db-test/node_modules/@electric-sql/pglite/dist/index.js';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite(),lot='Lot 5 · Girona - Alt Maresme';
const sql=fs.readFileSync(new URL('../sql/tsnu-lot5-expansion-2026-11-16.sql',import.meta.url),'utf8');
try{
 await db.exec(`create role anon; create role authenticated;
 create table tsnu_units(lot text,zone text,unit text,active boolean default true,primary key(lot,zone,unit));
 create table tsnu_unit_assignments(lot text,zone text,unit text,warehouse_id text,primary key(lot,unit),foreign key(lot,zone,unit) references tsnu_units);
 create table fleet_vehicle_registry(lot text,vehicle text,plate text,reference_zone text,reference_unit text,vehicle_type text,base text default '',locality text default '',primary key(lot,vehicle),unique(lot,plate));
 insert into tsnu_units values('${lot}','Olot','KE1384',true),('${lot}','Olot','KE1388',true),('Other lot','Olot','KE1384',true);
 insert into tsnu_unit_assignments values('${lot}','Olot','KE1384','lot5_olot_central');`);
 await db.exec(sql); await db.exec(sql);
 assert.equal((await db.query('select count(*)::int n from fleet_vehicle_registry')).rows[0].n,139);
 assert.equal((await db.query("select active from tsnu_units where lot=$1 and zone='Olot' and unit='KE1384'",[lot])).rows[0].active,false);
 assert.equal((await db.query("select active from tsnu_units where lot='Other lot'")).rows[0].active,true);
 assert.equal((await db.query('select warehouse_id from tsnu_unit_assignments')).rows[0].warehouse_id,'lot5_olot_central');
 assert.equal((await db.query("select tsnu_checklist_family('KB1404') f")).rows[0].f,'KE');
 assert.equal((await db.query("select tsnu_checklist_family('VL051') f")).rows[0].f,'T');
 await db.exec("update fleet_vehicle_registry set plate='9999ZZZ' where vehicle='VL051'");
 await assert.rejects(db.exec(sql),/EXISTING_VEHICLE_PLATE_CONFLICT/);
 await db.exec('rollback');
 assert.equal((await db.query("select plate from fleet_vehicle_registry where vehicle='VL051'")).rows[0].plate,'9999ZZZ');
 console.log('PASS: SQL runs, replay safe, foreign keys preserved, other lots and assignments unchanged, conflicting plates abort.');
}finally{await db.close();}
