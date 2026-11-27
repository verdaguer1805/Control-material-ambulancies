import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {checklistPendingKey,readChecklistPending,listChecklistPending,beginChecklistAttempt,failChecklistAttempt,confirmChecklistAttempt,checklistPendingText} from '../public/checklists/checklist-pending.js';
const memory=()=>{const m=new Map();return {m,get length(){return m.size},key:i=>[...m.keys()][i],getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
const scope={lot:'Lot 5 · Girona - Alt Maresme',zone:'Olot',unit:'G450',type:'SVB',vehicle:'5439',guardCode:'261126',guardStartedAt:'2026-11-26T06:00:00Z'};
test('pending attempt is durable before HTTP and survives reload, timeout and reconnection',()=>{
 const s=memory(),row=beginChecklistAttempt(s,scope);
 assert.equal(readChecklistPending(s,scope).reason,'sending');
 failChecklistAttempt(s,row,new TypeError('Failed to fetch'));
 assert.equal(readChecklistPending(s,scope).reason,'connection');
 const reload={...s,getItem:k=>s.m.get(k)??null};
 assert.equal(readChecklistPending(reload,scope).attemptId,row.attemptId);
 assert.match(checklistPendingText(readChecklistPending(s,scope),new Date('2026-11-26T12:00:00Z')),/todavía no ha confirmado/);
 failChecklistAttempt(s,row,new Error('CHECKLIST_REQUEST_TIMEOUT'));
 assert.equal(readChecklistPending(s,scope).reason,'timeout');
 assert.equal(listChecklistPending(s,{lot:scope.lot,zone:scope.zone,unit:scope.unit}).length,1);
});
test('only a valid server receipt clears the matching attempt; old receipt cannot clear newer resend',()=>{
 const s=memory(),first=beginChecklistAttempt(s,scope);
 assert.throws(()=>confirmChecklistAttempt(s,first,null),/CONFIRMATION_MISSING/);
 assert.throws(()=>confirmChecklistAttempt(s,first,'not a date'),/CONFIRMATION_MISSING/);
 const second=beginChecklistAttempt(s,scope);
 assert.equal(confirmChecklistAttempt(s,first,'2026-11-26T12:00:00Z'),false);
 assert.equal(readChecklistPending(s,scope).attemptId,second.attemptId);
 assert.equal(confirmChecklistAttempt(s,second,'2026-11-26T12:00:01Z'),true);
 assert.equal(readChecklistPending(s,scope),null);
});
test('all lots, zones, units, vehicles, guards and checklist families remain isolated',()=>{
 const s=memory();for(const field of ['lot','zone','unit','vehicle','guardCode','type'])beginChecklistAttempt(s,{...scope,[field]:'Other'});
 assert.equal(listChecklistPending(s,{lot:scope.lot,zone:scope.zone,unit:scope.unit}).length,3); // same unit scope, other vehicle/guard/type
 const row=beginChecklistAttempt(s,scope);confirmChecklistAttempt(s,row,'2026-11-26T12:00:00Z');
 assert.equal(s.length,6);
 assert.equal(listChecklistPending(s,{...scope,type:'SVB'}).length,2);
});
test('guard expiry preserves warning and identity instead of moving it to a new guard',()=>{
 const s=memory();beginChecklistAttempt(s,scope);
 const row=readChecklistPending(s,scope);
 assert.match(checklistPendingText(row,new Date('2026-11-27T06:00:00Z')),/plazo ha terminado/);
 assert.match(checklistPendingText(row,new Date('2026-11-27T06:00:00Z')),/no lo envíes.*turno nuevo/);
 assert.equal(readChecklistPending(s,{...scope,guardCode:'271126'}),null);
 assert.equal(s.length,1);
});
test('corrupted pending and storage failure never erase previous information or permit a fresh attempt',()=>{
 const s=memory(),key=checklistPendingKey(scope);s.setItem(key,'broken');
 assert.equal(readChecklistPending(s,scope).corrupt,true);
 assert.throws(()=>beginChecklistAttempt(s,scope),/STORAGE/);assert.equal(s.getItem(key),'broken');
 const blocked={...memory(),setItem:()=>{throw new Error('QuotaExceededError')}};
 assert.throws(()=>beginChecklistAttempt(blocked,scope),/Quota/);
});

test('malformed pending keys cannot break the unit screen or erase valid pending records',()=>{
 const s=memory(),row=beginChecklistAttempt(s,scope);
 s.setItem('cma_checklist_pending_v1:[]','broken');
 s.setItem('cma_checklist_pending_v1:'+JSON.stringify([scope.lot,scope.zone,scope.unit,'SVB',null,null]),'broken');
 s.setItem('cma_checklist_pending_v1:not-json','broken');
 assert.deepEqual(listChecklistPending(s,{lot:scope.lot,zone:scope.zone,unit:scope.unit}),[row]);
 assert.equal(s.length,4);
});
test('SVB persists before HTTP; BP and TSNU require server confirmation; app entry exposes warnings',()=>{
 const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
 const svb=read('public/checklists/svb-zones-production.js');
 assert(svb.indexOf('attempt=beginChecklistAttempt')<svb.indexOf('let response=await sendChecklist'));
 assert.match(svb,/pending\|\|\(complete/);
 assert.match(read('src/BpUnitChecklist.jsx'),/confirmChecklistAttempt/);
 assert.match(read('src/ChecklistDemo.jsx'),/operation.type==='checklist'&&!data\?\.checklist_submitted_at/);
 assert.match(read('src/main.jsx'),/<ChecklistPendingNotice/);
 assert.match(read('public/sw.js'),/checklist-pending.js/);
});
