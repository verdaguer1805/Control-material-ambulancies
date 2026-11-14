import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {withRequestDeadline,REQUEST_TIMEOUT_MS} from '../public/checklists/request-deadline.js';
import {queueTsnuOperation,readTsnuOutbox,syncTsnuOutbox} from '../src/tsnu-outbox.mjs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const storage=()=>{const map=new Map();return{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};};
test('deadline resolves success and errors; timeout aborts even an unresponsive transport',async()=>{
 assert.equal(REQUEST_TIMEOUT_MS,20000);
 assert.equal(await withRequestDeadline(async()=>42,50),42);
 await assert.rejects(withRequestDeadline(async()=>{throw new Error('REJECTED');},50),/REJECTED/);
 let signal;
 await assert.rejects(withRequestDeadline(s=>{signal=s;return new Promise(()=>{});},5),/CHECKLIST_REQUEST_TIMEOUT/);
 assert.equal(signal.aborted,true);
});
test('late success cannot confirm the UI after a timeout',async()=>{
 let finish,confirmed=false;
 await assert.rejects(withRequestDeadline(()=>new Promise(resolve=>finish=resolve),5).then(()=>confirmed=true),/CHECKLIST_REQUEST_TIMEOUT/);
 finish({ok:true});await new Promise(resolve=>setTimeout(resolve,1));assert.equal(confirmed,false);
});
test('lost response keeps TSNU outbox and retry uses original operation without duplicate server effect',async()=>{
 const s=storage(),server=new Map(),operation={localId:'local-1',shiftId:'guard-1',operationId:'op-1',type:'withdrawal',materials:{test:1}};
 queueTsnuOperation(s,operation);
 const first=await syncTsnuOutbox(s,op=>withRequestDeadline(()=>{server.set(op.operationId,op.materials);return new Promise(()=>{});},5));
 assert.equal(first.failed.length,1);assert.equal(readTsnuOutbox(s).length,1);assert.equal(first.stopped.message,'CHECKLIST_REQUEST_TIMEOUT');
 const second=await syncTsnuOutbox(s,op=>withRequestDeadline(async()=>{assert.equal(op.operationId,'op-1');server.set(op.operationId,op.materials);},50));
 assert.equal(second.synced.length,1);assert.equal(server.size,1);assert.equal(readTsnuOutbox(s).length,0);
});
test('all checklist request paths have a bounded wait and preserve confirmation handling',()=>{
 for(const file of ['src/BpUnitChecklist.jsx','src/VehicleAudit.jsx','src/ChecklistDemo.jsx','public/checklists/svb-zones-production.js'])assert.match(read(file),/withRequestDeadline/);
 assert.match(read('src/AuditorPortal.jsx'),/Promise.race/);assert.match(read('src/AuditorPortal.jsx'),/20000/);
 assert.match(read('public/checklists/svb-zones-production.js'),/confirmation\?\.submitted_at/);
 assert.match(read('src/VehicleAudit.jsx'),/data\?\.received_at/);
 assert.match(read('public/sw.js'),/request-deadline.js/);
});
test('server migrations define idempotent checklist/audit identities and reject conflicting audit retries',()=>{
 for(const file of ['sql/svb-guard-window-v1.sql','sql/bp-production-v1.sql'])assert.match(read(file),/on conflict\(lot,unit,guard_code,vehicle_label\)/);
 const audit=read('sql/supervisor-vehicle-audits-v1.sql');assert.match(audit,/where id=p_id/);assert.match(audit,/AUDIT_ALREADY_CONFIRMED/);
 const tsnu=read('sql/tsnu-checklist-equipment-v3.sql');assert.match(tsnu,/checklist_answers<>p_answers/);assert.match(tsnu,/return to_jsonb\(v_shift\)/);
});
