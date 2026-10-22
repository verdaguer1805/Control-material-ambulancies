import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {confirmedAuditorProfile,auditorReportRecords,auditorTransitionIssue,sameAuditorMaterials,AUDITOR_WORK_KEY} from '../src/auditor-client.mjs';
const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const profile={user_id:'user',full_name:'Marc Serra',lot:'Any lot',zone:'Figueres',warehouse_id:'fig-central',warehouse_name:'Central Figueres',revision:2,active:true,verified:true};

test('auditor feedback opens a centered modal that prevents repeated background clicks',()=>{
 const portal=read('src/AuditorPortal.jsx');
 assert.match(portal,/node.showModal\(\)/);
 assert.match(portal,/notice&&<AuditorNotice message=\{notice\} busy=\{busy\}/);
 assert.match(portal,/!busy&&<button[^>]+autoFocus[^>]+>Aceptar/);
 assert.match(portal,/if\(!busy\)onClose\(\)/);
 assert.match(read('src/auditor-portal.css'),/\.auditor-notice-dialog\{position:fixed;inset:0;margin:auto/);
});
test('warehouse confirmation requires the actual server scope, active identity and revision',()=>{
 assert.deepEqual(confirmedAuditorProfile(profile),profile);
 for(const key of ['verified','active','warehouse_id','warehouse_name','revision','user_id'])assert.equal(confirmedAuditorProfile({...profile,[key]:null}),null);
 assert.equal(confirmedAuditorProfile(profile,{full_name:'Marc Serra',lot:'Any lot',zone:'Olot',warehouse_id:'olot-central'}),null);
 const portal=read('src/AuditorPortal.jsx');assert.match(portal,/confirmedAuditorProfile\(result,expected\)/);
 assert.ok(portal.indexOf("const receipt=await call('get_my_auditor_consumption'")<portal.indexOf('setVerified(true)'));
 assert.match(portal,/p_warehouse_id:profile.warehouse_id/);
 assert.match(portal,/result.warehouse_id!==profile.warehouse_id/);
});
test('auditor report events keep their original zone, identity, warehouse and actual time',()=>{
 const row=auditorReportRecords([{id:'op',full_name:'Marc Serra',lot:'Other lot',zone:'Olot',warehouse_name:'Olot central',created_at:'2026-10-22T09:00:00Z',materials:{Gasas:2}}])[0];
 assert.equal(row.unit,'Auditor · Olot · Marc Serra');assert.equal(row.zone,'Olot');assert.equal(row.lot,'Other lot');assert.equal(row.time,'11:00:00');assert.equal(row.origin,'Auditor');assert.equal(row.entries[0].materials.Gasas,2);
 const main=read('src/main.jsx');assert.match(main,/if\(r.origin==='Auditor'\)return r.zone/);
 assert.match(main,/get_auditor_consumption_report/);assert.match(main,/AuditorManager access=\{adminAccess\}/);
});
test('profile switching preserves pending unit, supervisor and auditor data',()=>{
 const memory=entries=>({get length(){return Object.keys(entries).length;},key:index=>Object.keys(entries)[index],getItem:key=>entries[key]||null});
 assert.equal(auditorTransitionIssue(memory({})), '');
 assert.ok(auditorTransitionIssue(memory({}),{Gasas:1}));
 assert.ok(auditorTransitionIssue(memory({'cma_records':JSON.stringify([{synced:false}])})));
 assert.ok(auditorTransitionIssue(memory({[AUDITOR_WORK_KEY]:JSON.stringify({materials:{Gasas:2}})})));
 assert.ok(auditorTransitionIssue(memory({'cma_tsnu_outbox_v1':'[{"id":"op"}]'})));
 assert.ok(auditorTransitionIssue(memory({'cma_supervisor_vehicle_audits_v1':'[{"confirmedAt":null}]'})));
});
test('material receipt reconciliation ignores JSON key order but never ignores quantities',()=>{
 assert.equal(sameAuditorMaterials({Gasas:2,Suero:1},{Suero:1,Gasas:2}),true);
 assert.equal(sameAuditorMaterials({Gasas:2},{Gasas:3}),false);
 assert.equal(sameAuditorMaterials({Gasas:2},{Gasas:2,Suero:1}),false);
});
test('auditor SQL never trusts a client warehouse or grants administrator sessions',()=>{
 const sql=read('sql/named-auditors-v1.sql');
 assert.match(sql,/p.warehouse_id is distinct from p_warehouse_id/);
 assert.match(sql,/where warehouse_id=p.warehouse_id and material=m/);
 assert.match(sql,/p.revision<>p_revision/);
 assert.match(sql,/AUDITOR_PENDING_WORK/);
 assert.match(sql,/AUDITOR_OPERATION_CONFLICT/);
 assert.doesNotMatch(sql,/insert into public.admin_access_sessions/i);
 assert.match(sql,/update public.device_authorizations set active=false where user_id=auth.uid\(\) and active/);
 assert.doesNotMatch(sql,/update public.device_authorizations set active=false where unit=/);
 assert.match(sql,/where r.lot=p_lot and r.zone=p_zone/);
 assert.match(sql,/role='supervisor' and zone=p_zone/);
 assert.match(sql,/AUDITOR_ACCESS_LOCKED/);
 assert.match(sql,/from public,anon,authenticated/);
});
