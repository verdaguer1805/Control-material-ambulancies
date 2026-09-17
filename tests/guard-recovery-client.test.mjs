import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreGuardRecord,guardSaveRequest} from '../src/guard-recovery-client.mjs';

const context={unit:'G453',serverUnit:'G453',lot:'lot5',code:'170926',start:'2026-09-17T05:00:00Z',date:'2026-09-17',time:'07:00',warehouse:'Camprodon'};
const snapshot={token:'test-token',unit:'G453',lot:'lot5',guard_code:'170926',occurred_at:context.start,materials:{Gasa:3},incident_id:'existing',user_id:'new-device'};

test('recovered baseline plus new withdrawal survives offline reload without losing previous total',()=>{
 const records=restoreGuardRecord([],snapshot,context);
 records[0].entries.push({materials:{Gasa:2}});
 records[0].synced=false;
 const restored=JSON.parse(JSON.stringify(records));
 const request=guardSaveRequest(restored[0],'G453','Camprodon');
 assert.equal(request.name,'save_recovered_guard_consumption');
 assert.deepEqual(request.args.p_materials,{Gasa:5});
 assert.equal(request.args.p_token,'test-token');
 assert.deepEqual(guardSaveRequest(restored[0],'G453','Camprodon'),request);
});

test('pending local consumption is never overwritten during recovery',()=>{
 const records=[{unit:'G453',id:'170926',synced:false,entries:[{materials:{Gasa:7}}]}];
 const before=JSON.stringify(records);
 assert.throws(()=>restoreGuardRecord(records,snapshot,context),/LOCAL_PENDING/);
 assert.equal(JSON.stringify(records),before);
});

test('recovery rejects another unit, lot, guard, start or malformed material',()=>{
 for(const patch of [{unit:'G452'},{lot:'lot7'},{guard_code:'160926'},{occurred_at:'2026-09-17T06:00:00Z'},{materials:{Gasa:-1}},{materials:{Gasa:1.5}}]){
  assert.throws(()=>restoreGuardRecord([],{...snapshot,...patch},context),/INVALID_GUARD_SNAPSHOT/);
 }
});

test('other guards are retained and next guard does not reuse recovery baseline',()=>{
 const next={unit:'G453',id:'180926',date:'2026-09-18',time:'07:00',entries:[{materials:{Gasa:1}}],synced:true};
 const records=restoreGuardRecord([next],snapshot,context);
 assert.equal(records.length,2);
 assert.equal(records[0],next);
 const request=guardSaveRequest(next,'G453','Camprodon');
 assert.equal(request.name,'save_guard_consumption');
 assert.deepEqual(request.args.p_materials,{Gasa:1});
});
