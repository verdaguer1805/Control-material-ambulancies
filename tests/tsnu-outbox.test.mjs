import test from 'node:test';import assert from 'node:assert/strict';
import {queueTsnuOperation,removeTsnuOperation,removeTsnuShiftOperations,readTsnuOutbox,saveTsnuShift,readTsnuShift,rpcForTsnuOperation,syncTsnuOutbox} from '../src/tsnu-outbox.mjs';
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
test('TSNU outbox is ordered and idempotent locally',()=>{const s=memory(),a={localId:'1',type:'start',shiftId:'s',at:'2026-09-19T10:00:00Z'},b={localId:'2',type:'finish',shiftId:'s',at:'2026-09-19T11:00:00Z'};queueTsnuOperation(s,a);queueTsnuOperation(s,a);queueTsnuOperation(s,b);assert.deepEqual(readTsnuOutbox(s),[a,b]);removeTsnuOperation(s,'1');assert.deepEqual(readTsnuOutbox(s),[b]);});
test('active shift is isolated by unit and lot',()=>{const s=memory(),shift={unit:'T1731',lot:'Lot 5',id:'x'};saveTsnuShift(s,shift);assert.deepEqual(readTsnuShift(s,'T1731','Lot 5'),shift);assert.equal(readTsnuShift(s,'T1732','Lot 5'),null);saveTsnuShift(s,null);assert.equal(readTsnuShift(s,'T1731','Lot 5'),null);});
test('operations map to separate production RPCs',()=>{assert.equal(rpcForTsnuOperation({type:'withdrawal',operationId:'o',shiftId:'s',materials:{A:1}})[0],'append_tsnu_withdrawal');assert.throws(()=>rpcForTsnuOperation({type:'bad'}));});

test('a damaged old TSNU session does not block a later independent session',async()=>{
 const s=memory(),operations=[
  {localId:'old-start',type:'start',shiftId:'old',at:'2026-09-19T08:00:00Z'},
  {localId:'old-check',type:'checklist',shiftId:'old',answers:{}},
  {localId:'new-start',type:'start',shiftId:'new',at:'2026-09-20T08:00:00Z'},
  {localId:'new-check',type:'checklist',shiftId:'new',answers:{A:'ok'}}];
 operations.forEach(row=>queueTsnuOperation(s,row));
 const called=[];
 const result=await syncTsnuOutbox(s,async row=>{called.push(row.localId);if(row.localId==='old-start')throw new Error('INVALID_SHIFT');});
 assert.deepEqual(called,['old-start','new-start','new-check']);
 assert.deepEqual(result.synced.map(row=>row.localId),['new-start','new-check']);
 assert.deepEqual(readTsnuOutbox(s).map(row=>row.localId),['old-start','old-check']);
 assert.match(readTsnuOutbox(s)[0].lastSyncError,/INVALID_SHIFT/);
});

test('an authorization failure stops the whole device queue without deleting data',async()=>{
 const s=memory(),a={localId:'a',type:'start',shiftId:'one'},b={localId:'b',type:'start',shiftId:'two'};
 queueTsnuOperation(s,a);queueTsnuOperation(s,b);const called=[];
 const result=await syncTsnuOutbox(s,async row=>{called.push(row.localId);throw new Error('DEVICE_NOT_AUTHORIZED');});
 assert.deepEqual(called,['a']);assert.ok(result.stopped);assert.equal(readTsnuOutbox(s).length,2);
});

test('a network failure stops safely and a retry never duplicates confirmed operations',async()=>{
 const s=memory(),a={localId:'a',type:'start',shiftId:'one'},b={localId:'b',type:'checklist',shiftId:'one'};
 queueTsnuOperation(s,a);queueTsnuOperation(s,b);let online=false;const confirmed=[];
 await syncTsnuOutbox(s,async row=>{if(!online)throw new Error('Failed to fetch');confirmed.push(row.localId);});
 assert.equal(readTsnuOutbox(s).length,2);online=true;
 await syncTsnuOutbox(s,async row=>confirmed.push(row.localId));
 assert.deepEqual(confirmed,['a','b']);assert.equal(readTsnuOutbox(s).length,0);
});

test('supervised recovery removes only the selected TSNU session',()=>{
 const s=memory();
 [{localId:'a',shiftId:'old'},{localId:'b',shiftId:'old'},{localId:'c',shiftId:'new'}].forEach(row=>queueTsnuOperation(s,row));
 removeTsnuShiftOperations(s,'old');
 assert.deepEqual(readTsnuOutbox(s).map(row=>row.localId),['c']);
});
