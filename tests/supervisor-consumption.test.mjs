import test from 'node:test';
import assert from 'node:assert/strict';
import {appendSupervisorConsumption,supervisorDraft} from '../src/supervisor-consumption.mjs';
import {guardSaveRequest} from '../src/guard-recovery-client.mjs';

const baseline=()=>({id:'141026',unit:'Material Supervisor · Olot',lot:'lot5',date:'2026-10-14',guardOccurredAt:'2026-10-13T22:00:00Z',synced:true,recoveryToken:'token',serverMaterials:{Pañuelos:10},entries:[{materials:{Pañuelos:10}}]});
test('supervisor starts at zero and consecutive identical withdrawals each increase stock consumption',()=>{
 let record=baseline();
 assert.deepEqual(supervisorDraft(record),{});
 for (const total of [20,30]) {
  Object.assign(record,appendSupervisorConsumption(record,{Pañuelos:10},'2026-10-14T16:43:00Z'),{synced:false});
  const request=guardSaveRequest(record,record.unit,'Olot');
  assert.equal(request.args.p_materials.Pañuelos,total);
  assert.equal(request.name,'save_recovered_guard_consumption');
  record.synced=true;
  record.serverMaterials={...request.args.p_materials};
  assert.deepEqual(supervisorDraft(record),{});
 }
});
test('pending supervisor withdrawal survives reload and retries never add it twice',()=>{
 const record={...baseline(),...appendSupervisorConsumption(baseline(),{Pañuelos:10,Gasa:2},'2026-10-14T16:43:00Z'),synced:false};
 const reloaded=JSON.parse(JSON.stringify(record));
 assert.deepEqual(supervisorDraft(reloaded),{Pañuelos:10,Gasa:2});
 const request=guardSaveRequest(reloaded,reloaded.unit,'Olot');
 assert.deepEqual(request.args.p_materials,{Pañuelos:20,Gasa:2});
 assert.deepEqual(guardSaveRequest(reloaded,reloaded.unit,'Olot'),request);
 assert.throws(()=>appendSupervisorConsumption(reloaded,{Pañuelos:10},'later'),/PENDING/);
});
test('legacy supervisor daily totals remain accounted for and empty sends are rejected',()=>{
 assert.deepEqual(supervisorDraft({...baseline(),synced:false}),{});
 assert.throws(()=>appendSupervisorConsumption(baseline(),{},'now'),/EMPTY/);
 assert.deepEqual(appendSupervisorConsumption(null,{Gasa:2},'now').entries,[{createdAt:'now',materials:{Gasa:2}}]);
});
