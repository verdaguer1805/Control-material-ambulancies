import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {correctionService,tsnuCorrectionRows,consumptionCorrectionRequest} from '../src/consumption-correction-service.mjs';

test('correction unit type is visible between supervision and guard date',()=>{
 const source=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
 const modal=source.slice(source.indexOf('{correctionOpen && ('),source.indexOf('{accessCodesOpen && ('));
 assert.ok(modal.indexOf('<label>Supervisión</label>')<modal.indexOf('<label>Tipo de unidad</label>'));
 assert.ok(modal.indexOf('<label>Tipo de unidad</label>')<modal.indexOf('<label>Fecha de guardia</label>'));
});

test('service selector includes BP with TSU and T1744 with TSNU',()=>{
 const lot='Lot 5 · Girona - Alt Maresme';
 assert.equal(correctionService('BP52',lot,'Olot'),'TSU');
 assert.equal(correctionService('G450',lot,'Olot'),'TSU');
 assert.equal(correctionService('T1744',lot,'Olot'),'TSNU');
});
test('TSNU rows use server units and Madrid guard date in any lot or zone',()=>{
 const rows=tsnuCorrectionRows({shifts:[{id:'shift',unit:'OTHER123',lot:'Other lot',zone:'Other zone',started_at:'2026-10-08T22:10:00Z',ended_at:'2026-10-09T20:00:00Z'}],withdrawals:[{operation_id:'op',shift_id:'shift',unit:'OTHER123',created_at:'2026-10-09T06:00:00Z',materials:{Papel:4}}]});
 assert.equal(rows[0].incident_code,'091026');assert.equal(rows[0].id,'op');
 assert.equal(rows[0].unit,'OTHER123');assert.equal(rows[0].service,'TSNU');
 assert.equal(tsnuCorrectionRows({withdrawals:[{shift_id:'missing'}]}).length,0);
});
test('TSNU correction routes to separate protected RPC and accepts zero',()=>{
 const params={lot:'any',material:'Papel',quantity:0,previous:4,reason:'Error humano'};
 const [rpc,request]=consumptionCorrectionRequest({id:'op',service:'TSNU'},params);
 assert.equal(rpc,'correct_tsnu_consumption');assert.equal(request.p_corrected_quantity,0);assert.equal(request.p_expected_quantity,4);assert.equal(request.p_lot,'any');
 assert.equal(consumptionCorrectionRequest({id:'i',service:'TSU'},params)[0],'correct_guard_consumption');
});
test('TSNU correction SQL is transactional, scoped, audited and preserves original withdrawals',()=>{
 const sql=fs.readFileSync(new URL('../sql/admin-tsnu-consumption-corrections-v1.sql',import.meta.url),'utf8');
 assert.match(sql,/v_shift.lot is distinct from p_lot/);assert.match(sql,/admin_can_access_zone\(v_shift.zone\)/);
 assert.match(sql,/v_shift.ended_at is null/);assert.match(sql,/for update/);assert.match(sql,/CORRECTION_CONFLICT/);
 assert.match(sql,/quantity=quantity\+v_delta/);assert.match(sql,/pending_replenishment-v_delta/);
 assert.match(sql,/coalesce\(o.materials,x.materials\)/);assert.match(sql,/actor_user_id/);
 assert.doesNotMatch(sql,/(update|delete from) public\.(tsnu_withdrawals|incidents)/i);
 assert.doesNotMatch(sql,/Olot|T1744|lot5_olot/i);
});
