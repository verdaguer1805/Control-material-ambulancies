import test from 'node:test';
import assert from 'node:assert/strict';
import {canRecoverAuditor} from '../src/auditor-recovery.mjs';
const p={user_id:'test',active:false,revision:3,full_name:'Test Auditor',lot:'Lot X',zone:'Zone X',warehouse_id:'central-x'};
const d={id:'5132-test',auditorUserId:p.user_id,profileRevision:3,lot:p.lot,zone:p.zone,warehouseId:p.warehouse_id,supervisor:`Auditor · ${p.zone} · ${p.full_name}`,answers:{x:'issue'},notes:{x:'Keep'}};
test('same inactive mobile can recover pending work without changing input data',()=>{
 const before=JSON.stringify(d);assert.equal(canRecoverAuditor(p,p,[d],{revision:3,materials:{Gasas:2}}),true);assert.equal(JSON.stringify(d),before);
});
test('recovery rejects reassignment, active profiles, other identities and stale revisions',()=>{
 for(const key of ['full_name','lot','zone','warehouse_id'])assert.equal(canRecoverAuditor(p,{...p,[key]:'different'},[d]),false);
 assert.equal(canRecoverAuditor({...p,active:true},p,[d]),false);
 for(const changes of [{auditorUserId:'other'},{profileRevision:2},{warehouseId:'other'},{lot:'other'},{zone:'other'}])assert.equal(canRecoverAuditor(p,p,[{...d,...changes}]),false);
 assert.equal(canRecoverAuditor(p,p,[d],{revision:2,materials:{Gasas:1}}),false);
});
