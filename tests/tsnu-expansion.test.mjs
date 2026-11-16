import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TSNU_FLEET_ADDITIONS} from '../src/tsnu-fleet-additions.mjs';
import {TSNU_UNITS,validateUnitChecklist} from '../src/unit-checklist-config.mjs';
import {validTsnuAuditVehicle} from '../src/vehicle-audit.mjs';
const lot='Lot 5 · Girona - Alt Maresme';
test('confirmed roster counts and KE exceptions are exact, with unique plates and units',()=>{
 assert.equal(TSNU_FLEET_ADDITIONS.length,139);
 assert.equal(new Set(TSNU_FLEET_ADDITIONS.map(r=>r.unit)).size,139);
 assert.equal(new Set(TSNU_FLEET_ADDITIONS.map(r=>r.plate)).size,139);
 for(const [zone,count] of Object.entries({Olot:18,Figueres:23,Girona:51,Blanes:64}))assert.equal(Object.keys(TSNU_UNITS[lot][zone]).length,count);
 assert.equal(TSNU_UNITS[lot].Olot.KE1384,undefined);
 assert.equal(TSNU_UNITS[lot].Girona.KE1384,'TSNU');
 assert.equal(TSNU_UNITS[lot].Olot.KE1388,'TSNU');
 assert.equal(TSNU_UNITS[lot].Girona.KE1388,undefined);
 for(const row of TSNU_FLEET_ADDITIONS){
  assert.match(row.plate,/^\d{4}[A-Z]{3}$/);
  assert.ok(validTsnuAuditVehicle(row.unit));
  assert.equal(validateUnitChecklist({...row,service:'TSNU',warehouse:'Selected warehouse',warehouseId:'explicit'},TSNU_UNITS[lot][row.zone]).checklist,'TSNU');
 }
});
test('SQL and frontend contain exactly the same imported vehicle/plate pairs',()=>{
 const sql=fs.readFileSync(new URL('../sql/tsnu-lot5-expansion-2026-11-16.sql',import.meta.url),'utf8');
 const rows=[...sql.matchAll(/\('(Figueres|Girona|Blanes|Olot)','([A-Z]+\d+)','(\d{4}[A-Z]{3})'\)/g)].map(m=>[m[1],m[2],m[3]]);
 assert.deepEqual(rows,TSNU_FLEET_ADDITIONS.map(r=>[r.zone,r.unit,r.plate]));
 assert.doesNotMatch(sql,/\b(update|delete from|insert into)\s+public\.(warehouse_inventory|tsnu_shift_sessions|tsnu_unit_assignments|device_authorizations)/i);
});
