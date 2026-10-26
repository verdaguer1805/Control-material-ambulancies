import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {AUDITOR_OFFLINE_KEY,readOfflineAuditor,rememberOfflineAuditor,auditorConnectionFailure,requireAuditScope,newestPendingAudit} from '../src/auditor-offline.mjs';
import {clearAuditorLocalProfile} from '../src/auditor-client.mjs';
import {saveAudit,readAudits,auditItems} from '../src/vehicle-audit.mjs';
const p={user_id:'user-a',full_name:'Persona Prueba',lot:'Other lot',zone:'Other zone',warehouse_id:'other-central',warehouse_name:'Central',revision:2,active:true,verified:true};
const store=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
test('pending resume retains newer local offline work, rather than replacing it with an older remote audit',()=>{
 const old={id:'a',startedAt:'2026-10-25T10:00:00Z',editVersion:2},newer={id:'b',startedAt:'2026-10-26T10:00:00Z',editVersion:3};
 assert.equal(newestPendingAudit([old],[newer]).id,'b');
 assert.equal(newestPendingAudit([{...newer,editVersion:1}],[newer]).editVersion,3);
 assert.equal(newestPendingAudit([newer],[{...newer,sendRequestedAt:'pending'}]).sendRequestedAt,'pending');
 assert.equal(newestPendingAudit([],[{...newer,confirmedAt:'done'}]),undefined);
});
function bind(s){s.setItem('cma_mobile_role_v1','auditor');s.setItem('cma_unit',`Auditor · ${p.zone} · ${p.full_name}`);s.setItem('cma_lot',p.lot);s.setItem('cma_authorized_auth_identity_v1',JSON.stringify({unit:`Auditor · ${p.zone} · ${p.full_name}`,userId:p.user_id}));}
test('offline review is available only for an already confirmed profile bound to the same phone identity and scope',()=>{
 const s=store();assert.equal(readOfflineAuditor(s),null);rememberOfflineAuditor(s,p);assert.equal(readOfflineAuditor(s),null);bind(s);assert.deepEqual(readOfflineAuditor(s),p);
 for(const [key,value] of [['cma_lot','different lot'],['cma_mobile_role_v1','unit'],['cma_unit','G450'],['cma_authorized_auth_identity_v1',JSON.stringify({unit:`Auditor · ${p.zone} · ${p.full_name}`,userId:'someone-else'})]]){
  const before=s.getItem(key);s.setItem(key,value);assert.equal(readOfflineAuditor(s),null);s.setItem(key,before);
 }
 s.setItem(AUDITOR_OFFLINE_KEY,'broken');assert.equal(readOfflineAuditor(s),null);
 assert.throws(()=>rememberOfflineAuditor(s,{...p,active:false}),/NOT_AUTHORIZED/);
});
test('connection failures never disguise explicit server revocation or mismatched warehouse authorization',()=>{
 for(const message of ['AUDITOR_OFFLINE','AUDITOR_REQUEST_TIMEOUT','TypeError: Failed to fetch','Load failed'])assert.equal(auditorConnectionFailure(new Error(message)),true);
 for(const message of ['AUDITOR_NOT_AUTHORIZED','AUDITOR_ASSIGNMENT_CHANGED','AUDITOR_WAREHOUSE_MISMATCH','permission denied'])assert.equal(auditorConnectionFailure(new Error(message)),false);
 const s=store();bind(s);rememberOfflineAuditor(s,p);clearAuditorLocalProfile(s);assert.equal(readOfflineAuditor(s),null);
});
test('offline drafts retain answers, notes, pending-send intent and original IDs across reload, and reject reassignment',()=>{
 const s=store(),draft={id:'stable-id',vehicle:'KE1234',type:'TSNU',supervisor:`Auditor · ${p.zone} · ${p.full_name}`,lot:p.lot,zone:p.zone,auditorUserId:p.user_id,profileRevision:p.revision,warehouseId:p.warehouse_id,catalog:auditItems('TSNU','KE1234'),answers:{'tsnu-0:0':'issue'},notes:{'tsnu-0:0':'Prueba'},sendRequestedAt:'2026-10-26T10:00:00Z'};
 saveAudit(s,draft);const restored=readAudits({...s})[0];assert.deepEqual(restored,draft);requireAuditScope(restored,p);
 for(const changes of [{lot:'wrong'},{zone:'wrong'},{user_id:'wrong'},{revision:3},{warehouse_id:'wrong'}])assert.throws(()=>requireAuditScope(restored,{...p,...changes}),/ASSIGNMENT_CHANGED/);
});
test('only the named auditor path uses local-review permission; submission freshly verifies and preserves pending state',()=>{
 const portal=fs.readFileSync(new URL('../src/AuditorPortal.jsx',import.meta.url),'utf8'),audit=fs.readFileSync(new URL('../src/VehicleAudit.jsx',import.meta.url),'utf8');
 assert.match(portal,/authorized=\{canReview\} sendAuthorized=\{verified\}/);
 assert.match(portal,/submit:async draft=>\{\s*if\(!await verify\(\)\)/);
 assert.match(portal,/requireAuditScope\(draft,p\);/);
 assert.match(audit,/sendRequestedAt:draft.sendRequestedAt\|\|new Date/);
 assert.match(audit,/Auditoría pendiente de enviar/);
 assert.match(audit,/sendAuthorized=authorized/);
});
