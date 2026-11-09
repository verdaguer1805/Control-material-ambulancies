import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {confirmedAuditorProfile,auditorNeedsSetup,auditorError} from '../src/auditor-client.mjs';
import {AUDITOR_OFFLINE_KEY,readOfflineAuditor,rememberOfflineAuditor,auditorConnectionFailure,auditorSessionFailure,auditorAccessDenied} from '../src/auditor-offline.mjs';
const source=fs.readFileSync(new URL('../src/AuditorPortal.jsx',import.meta.url),'utf8');
const failure=source.slice(source.indexOf(' function verificationFailure('),source.indexOf(' useEffect(()=>{setupMode.current=setup;'));
const verify=source.slice(source.indexOf(' async function verify(){'),source.indexOf(' useEffect(()=>{void verify();'));
const profile={user_id:'original',full_name:'Example Person',lot:'Other lot',zone:'Other zone',warehouse_id:'central',warehouse_name:'Central',revision:1,active:true,verified:true};
function harness(){
 const values=new Map([
  ['cma_mobile_role_v1','auditor'],['cma_unit','Auditor · Other zone · Example Person'],['cma_lot','Other lot'],
  ['cma_authorized_auth_identity_v1',JSON.stringify({userId:'original',unit:'Auditor · Other zone · Example Person'})],
  [AUDITOR_OFFLINE_KEY,JSON.stringify(profile)],['cma_supervisor_vehicle_audits_v1','KEEP DRAFT'],['cma_auditor_material_draft_v1','KEEP MATERIAL']
 ]);
 const state={};
 const env={
  localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},
  lastVerifyError:{current:null},profileNow:{current:profile},leaving:{current:false},verifyRun:{current:0},setupMode:{current:false},
  auditorConnectionFailure,auditorSessionFailure,auditorAccessDenied,readOfflineAuditor,AUDITOR_OFFLINE_KEY,auditorError,confirmedAuditorProfile,auditorNeedsSetup,rememberOfflineAuditor,
  call:async()=>null
 };
 for(const key of ['Verified','CanReview','ConnectionNote','Notice','Profile','Name','Lot','Zone','Warehouse','Code','Setup','Loading'])env['set'+key]=v=>{state[key]=v;};
 const functions=new Function('env',`with(env){${failure}\n${verify};return {verify,verificationFailure};}`)(env);
 return {env,state,values,...functions};
}
test('reopening with a session recovery failure preserves profile and pending work, never authorizes upload',()=>{
 const h=harness();h.verificationFailure(new Error('LOCAL_AUTH_SESSION_MISSING'));
 assert.equal(h.state.Verified,false);assert.equal(h.state.CanReview,true);
 assert.equal(h.values.get(AUDITOR_OFFLINE_KEY),JSON.stringify(profile));
 assert.equal(h.values.get('cma_supervisor_vehicle_audits_v1'),'KEEP DRAFT');
 assert.equal(h.values.get('cma_auditor_material_draft_v1'),'KEEP MATERIAL');
 assert.equal(h.state.Setup,undefined);
});
test('missing server profile after reopen does not open fresh authorization or delete local profile',async()=>{
 const h=harness();await h.verify();
 assert.equal(h.env.lastVerifyError.current.message,'AUDITOR_PROFILE_NOT_FOUND');
 assert.equal(h.state.Setup,undefined);assert.equal(h.state.Verified,false);
 assert.ok(h.values.has(AUDITOR_OFFLINE_KEY));
});
test('different returned user cannot replace the auditor identity',async()=>{
 const h=harness();h.env.call=async()=>({...profile,user_id:'different'});await h.verify();
 assert.equal(h.env.lastVerifyError.current.message,'LOCAL_AUTH_SESSION_MISSING');
 assert.equal(h.env.profileNow.current.user_id,'original');assert.equal(h.state.Profile,undefined);
 assert.equal(h.state.Verified,false);assert.ok(h.values.has(AUDITOR_OFFLINE_KEY));
});
test('actual revoked profile blocks review and upload while keeping pending drafts',async()=>{
 const h=harness();h.env.call=async()=>({...profile,active:false,verified:false});await h.verify();
 assert.equal(h.state.Verified,false);assert.equal(h.state.CanReview,false);assert.equal(h.state.Setup,true);
 assert.equal(h.values.has(AUDITOR_OFFLINE_KEY),false);
 assert.equal(h.values.get('cma_supervisor_vehicle_audits_v1'),'KEEP DRAFT');
});
