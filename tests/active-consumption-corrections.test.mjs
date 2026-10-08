import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {guardSaveRequest,restoreGuardRecord} from '../src/guard-recovery-client.mjs';
const start='2026-10-07T22:00:00Z';
const context={unit:'SUPERVISOR_OLOT',serverUnit:'Material Supervisor · Olot',lot:'lot5',code:'081026',start,date:'2026-10-08',time:'00:00',warehouse:'Olot'};
const snapshot={token:'token',unit:context.serverUnit,lot:context.lot,guard_code:context.code,occurred_at:start,materials:{Papel:1},incident_id:'existing',user_id:'device'};
test('a recovered total can be explicitly corrected to zero with its previous total',()=>{
 const [record]=restoreGuardRecord([],snapshot,context);
 record.entries=[{materials:{}}];
 const request=guardSaveRequest(record,context.serverUnit,'Olot');
 assert.equal(request.name,'correct_active_guard_consumption');
 assert.deepEqual(request.args.p_expected_materials,{Papel:1});
 assert.deepEqual(request.args.p_materials,{});
 assert.equal(request.args.p_occurred_at,start);
 assert.deepEqual(guardSaveRequest(JSON.parse(JSON.stringify(record)),context.serverUnit,'Olot'),request);
});
test('a partial reduction preserves other materials and increases remain on the protected save path',()=>{
 const [record]=restoreGuardRecord([],snapshot,context);
 record.entries=[{materials:{Papel:2}}];
 assert.equal(guardSaveRequest(record,context.serverUnit,'Olot').name,'save_recovered_guard_consumption');
 record.serverMaterials={Papel:2,Gasa:3};
 record.entries=[{materials:{Gasa:3}}];
 assert.deepEqual(guardSaveRequest(record,context.serverUnit,'Olot').args.p_materials,{Gasa:3});
});
test('first empty save remains blocked but existing records can be cleared',()=>{
 const source=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
 assert.match(source,/!Object.keys\(used\).length && !noMaterial && !hasExistingConsumption/);
 assert.match(source,/previousRecord.serverIncidentId \|\| !previousRecord.recoveredBaseline/);
 assert.match(source,/rec\.serverMaterials = \{ \.\.\.used \}/);
});
test('server correction is authorized, serialized, compare-and-swap and idempotent',()=>{
 const sql=readFileSync(new URL('../sql/active-consumption-corrections-v1.sql',import.meta.url),'utf8');
 assert.match(sql,/require_single_consumption_device/);
 assert.match(sql,/v_session.user_id<>auth.uid\(\)/);
 assert.match(sql,/for update/);
 assert.match(sql,/v_inc.materials is distinct from p_expected_materials/);
 assert.ok(sql.indexOf('if v_inc.materials=p_materials then return')<sql.indexOf('save_guard_consumption_authorized_impl'));
 assert.match(sql,/from public,anon/);
});
