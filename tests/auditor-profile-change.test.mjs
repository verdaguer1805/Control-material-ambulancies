import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {clearAuditorLocalProfile} from '../src/auditor-client.mjs';

const source=fs.readFileSync(new URL('../src/AuditorPortal.jsx',import.meta.url),'utf8');
const change=source.slice(source.indexOf(' function requestLeave(){'),source.indexOf(' async function registerDraft('));
const authorize=source.slice(source.indexOf(' async function authorize(event){'),source.indexOf(' function edit('));
const cancelSetup=source.slice(source.indexOf(' function cancelSetup(){'),source.indexOf(' async function authorize(event){'));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
test('cancel assignment edit rechecks existing active access, never grants or revokes, and avoids inactive loops',()=>{
 for(const active of [true,false]){
  const state={checks:0};const env={authorizing:{current:false},leaving:{current:false},profile:{active},setupMode:{current:true},
   setCode:value=>{state.code=value;},setNotice:value=>{state.notice=value;},setSetup:value=>{state.setup=value;},verify:()=>{state.checks++;}};
  const cancel=new Function('env',`with(env){${cancelSetup};return cancelSetup;}`)(env);cancel();
  assert.equal(state.checks,active?1:0);assert.equal(state.setup,false);assert.equal(state.code,'');assert.equal(env.setupMode.current,!active);
  env.authorizing.current=true;state.setup=true;cancel();assert.equal(state.setup,true);
 }
 assert.doesNotMatch(cancelSetup,/leave_mobile_auditor|authorize_mobile_auditor|clearAuditorLocalProfile/);
});
function harness(){
 const values=new Map([
  ['cma_mobile_role_v1','auditor'],['cma_unit','Auditor · Zone A · Test Person'],
  ['cma_authorized_auth_identity_v1','KEEP IDENTITY'],['cma_auditor_verified_profile_v1','KEEP PROFILE'],
  ['cma_auditor_material_draft_v1','{"materials":{}}'],['cma_supervisor_vehicle_audits_v1','KEEP HISTORY'],
 ]);
 const state={calls:0,exits:0,pending:false};
 const env={
  leaving:{current:false},authorizing:{current:false},verifyRun:{current:0},busy:false,leavePrompt:false,pending:[],
  saveQueue:{current:Promise.resolve()},simulation:true,profile:{user_id:'same-phone',active:true},
  localStorage:{getItem:key=>values.get(key)||null,removeItem:key=>values.delete(key)},
  clearAuditorLocalProfile,hasLocalPending:()=>state.pending,auditorError:error=>error.message,
  setLeavePrompt:value=>{env.leavePrompt=value;},setNotice:value=>{state.notice=value;},setBusy:value=>{state.busy=value;},
  call:async()=>{state.calls++;return true;},onLeave:()=>{state.exits++;},
 };
 const functions=new Function('env',`with(env){${change};return {requestLeave,leave};}`)(env);
 return {env,state,values,...functions};
}

test('change profile first asks for explicit confirmation, cancelling makes no request or local changes',()=>{
 const h=harness(),before=[...h.values];h.requestLeave();
 assert.equal(h.env.leavePrompt,true);assert.equal(h.state.calls,0);assert.deepEqual([...h.values],before);
 h.env.setLeavePrompt(false);assert.equal(h.state.exits,0);assert.deepEqual([...h.values],before);
 assert.match(source,/onClick=\{requestLeave\}>Cambiar perfil/);
 assert.match(source,/Si solo has terminado por hoy, cancela y cierra la aplicación/);
 assert.match(source,/className="auditor-notice-dialog" aria-labelledby="auditor-profile-change-title"/);
});

test('confirmed change waits for server true, keeps sent history and prevents double submission synchronously',async()=>{
 const h=harness(),response=deferred();h.env.call=async()=>{h.state.calls++;return response.promise;};
 h.requestLeave();const first=h.leave(),second=h.leave();await Promise.resolve();
 assert.equal(h.state.calls,1);assert.equal(h.state.exits,0);assert.ok(h.values.has('cma_authorized_auth_identity_v1'));
 response.resolve(true);await Promise.all([first,second]);
 assert.equal(h.state.exits,1);assert.equal(h.values.has('cma_mobile_role_v1'),false);
 assert.equal(h.values.get('cma_supervisor_vehicle_audits_v1'),'KEEP HISTORY');assert.equal(h.env.leaving.current,false);
});

test('ambiguous leave responses and lost connection never remove profile, identity or work',async()=>{
 for(const result of [null,undefined,false,{},'true']){
  const h=harness(),before=[...h.values];h.env.call=async()=>result;h.requestLeave();await h.leave();
  assert.equal(h.state.exits,0);assert.deepEqual([...h.values],before);assert.equal(h.state.notice,'AUDITOR_LEAVE_NOT_CONFIRMED');
  assert.equal(h.state.busy,false);assert.equal(h.env.leaving.current,false);
 }
 const h=harness(),before=[...h.values];h.env.call=async()=>{throw new Error('AUDITOR_REQUEST_TIMEOUT');};h.requestLeave();await h.leave();
 assert.deepEqual([...h.values],before);assert.equal(h.state.exits,0);assert.equal(h.state.notice,'AUDITOR_REQUEST_TIMEOUT');
});

test('pending work blocks change before confirmation and again before local cleanup',async()=>{
 const h=harness();h.state.pending=true;h.requestLeave();assert.equal(h.env.leavePrompt,false);assert.equal(h.state.calls,0);
 h.state.pending=false;h.env.pending=[{id:'remote-audit'}];h.requestLeave();assert.equal(h.env.leavePrompt,false);
 h.env.pending=[];h.requestLeave();const before=[...h.values];h.env.call=async()=>{h.state.pending=true;return true;};await h.leave();
 assert.equal(h.state.exits,0);assert.deepEqual([...h.values],before);assert.equal(h.state.notice,'AUDITOR_PENDING_WORK');
});

test('already inactive profile still requires confirmed server leave; initial unconfigured cancel needs no mutation',async()=>{
 const inactive=harness();inactive.env.profile.active=false;inactive.requestLeave();await inactive.leave();assert.equal(inactive.state.calls,1);assert.equal(inactive.state.exits,1);
 const fresh=harness();fresh.env.profile=null;fresh.requestLeave();await fresh.leave();assert.equal(fresh.state.calls,0);assert.equal(fresh.state.exits,1);
});

test('authorization has a synchronous lock, no duplicate RPC before React commits busy state',async()=>{
 const response=deferred(),state={calls:0};
 const env={authorizing:{current:false},leaving:{current:false},closeUnitRequired:false,closeUnitConfirmed:false,
  name:'Test Person',lot:'Lot A',zone:'Zone A',warehouse:'warehouse-a',code:'local-test',profile:null,
  localStorage:{},currentWork:{current:null},readAudits:()=>[],canRecoverAuditor:()=>false,hasLocalPending:()=>false,
  setBusy:()=>{},setVerified:()=>{},setNotice:message=>{state.notice=message;},auditorError:error=>error.message,
  call:async()=>{state.calls++;return response.promise;},
 };
 const submit=new Function('env',`with(env){${authorize};return authorize;}`)(env),event={preventDefault(){}};
 const first=submit(event),second=submit(event);assert.equal(state.calls,1);
 response.reject(new Error('LOCAL_TEST_REJECTION'));await Promise.all([first,second]);assert.equal(env.authorizing.current,false);
 assert.equal(state.notice,'LOCAL_TEST_REJECTION');
});
