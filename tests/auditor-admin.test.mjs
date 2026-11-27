import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {auditorAdminRequest,auditorAdminError,auditorLastAuthorization} from '../src/auditor-admin.mjs';

const source=fs.readFileSync(new URL('../src/AuditorManager.jsx',import.meta.url),'utf8');
const handlers=source.slice(source.indexOf(' async function readRows(){'),source.indexOf('\n return <section',source.indexOf(' async function readRows(){')));
const one={user_id:'phone-one',full_name:'Same Person',active:true,revision:3,updated_at:'2026-11-27T12:00:00Z',last_authorized_at:'2026-11-27T12:00:00Z',lot:'Lot A',zone:'Zone A',warehouse_name:'Central A'};
const two={...one,user_id:'phone-two',lot:'Lot B',zone:'Zone B',warehouse_name:'Central B'};
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function harness(){
 const state={calls:[],rows:[]};
 const env={inFlight:{current:false},target:null,stale:true,auditorAdminError,
  setRows:value=>{state.rows=value;},setStale:value=>{env.stale=value;},setBusy:value=>{state.busy=value;},setOpen:value=>{state.open=value;},setNotice:value=>{state.notice=value;},setTarget:value=>{env.target=value;},
  rpc:async(name,args)=>{state.calls.push({name,args});return name==='list_mobile_auditors'?[one,two]:true;},
 };
 const methods=new Function('env',`with(env){${handlers};return {load,requestRevoke,cancelDialog,revoke};}`)(env);
 return {state,env,...methods};
}

test('Admin keeps distinct phones, asks explicit confirmation, and cancelling never sends a revoke',async()=>{
 const h=harness();await h.load();assert.deepEqual(h.state.rows,[one,two]);assert.equal(h.env.stale,false);
 h.requestRevoke(one);assert.deepEqual(h.env.target,one);assert.notEqual(h.env.target,one);assert.equal(h.state.calls.length,1);
 h.cancelDialog();assert.equal(h.env.target,null);await h.revoke();assert.equal(h.state.calls.length,1);
 assert.match(source,/target.user_id.slice\(0,8\)/);assert.match(source,/target.lot/);assert.match(source,/target.zone/);assert.match(source,/target.warehouse_name/);
 assert.match(source,/pending_audits_count/);assert.match(source,/pending_materials/);
 assert.match(source,/autoFocus type="button" className="secondary" disabled=\{busy\} onClick=\{onCancel\}>Cancelar/);
 assert.match(source,/onCancel=\{e=>\{e.preventDefault\(\);if\(!busy\)onCancel\(\);\}\}/);
});

test('confirmed revoke uses exact shown grant, prevents double requests and checks server after success',async()=>{
 const h=harness();await h.load();h.requestRevoke(one);const delayed=deferred();
 h.env.rpc=async(name,args)=>{h.state.calls.push({name,args});return name==='list_mobile_auditors'?[{...one,active:false},two]:delayed.promise;};
 const first=h.revoke(),second=h.revoke();assert.equal(h.state.calls.filter(c=>c.name==='revoke_mobile_auditor_checked').length,1);
 assert.deepEqual(h.state.calls.at(-1).args,{p_user_id:one.user_id,p_expected_revision:one.revision,p_expected_updated_at:one.updated_at});
 delayed.resolve(true);await Promise.all([first,second]);assert.deepEqual(h.state.rows,[two]);assert.match(h.state.notice,/revocado y comprobado/);
 assert.equal(h.env.target,null);assert.equal(h.env.inFlight.current,false);assert.equal(h.state.busy,false);
 assert.doesNotMatch(source,/rpc\('revoke_mobile_auditor'[,)]/,'no fallback bypassing stale grant check');
});

test('lost revoke response reconciles inactive result without a second write',async()=>{
 const h=harness();await h.load();h.requestRevoke(one);
 h.env.rpc=async(name,args)=>{h.state.calls.push({name,args});if(name==='list_mobile_auditors')return [{...one,active:false},two];throw new Error('AUDITOR_ADMIN_REQUEST_TIMEOUT');};
 await h.revoke();assert.match(h.state.notice,/está inactivo/);assert.equal(h.state.calls.filter(c=>c.name==='revoke_mobile_auditor_checked').length,1);assert.deepEqual(h.state.rows,[two]);
});

test('timeout followed by active or missing scope never claims revocation',async()=>{
 for(const rows of [[one,two],[two]]){
  const h=harness();await h.load();h.requestRevoke(one);
  h.env.rpc=async(name,args)=>{h.state.calls.push({name,args});if(name==='list_mobile_auditors')return rows;throw new Error('AUDITOR_ADMIN_REQUEST_TIMEOUT');};
  await h.revoke();assert.doesNotMatch(h.state.notice,/está inactivo|revocado y comprobado/);
  assert.match(h.state.notice,rows.length===2?/móvil activo/:/no se puede comprobar/);assert.equal(h.env.stale,false);
 }
});

test('unconfirmed result is not accepted and failed refresh preserves rows but disables further revocation',async()=>{
 for(const result of [null,false,{},'true']){
  const h=harness();await h.load();h.requestRevoke(one);
  h.env.rpc=async(name,args)=>{h.state.calls.push({name,args});if(name==='list_mobile_auditors')throw new Error('network');return result;};
  await h.revoke();assert.equal(h.env.stale,true);assert.deepEqual(h.state.rows,[one,two]);assert.match(h.state.notice,/No se ha podido confirmar/);
  h.requestRevoke(two);assert.equal(h.env.target,null);const count=h.state.calls.length;await h.revoke();assert.equal(h.state.calls.length,count);
 }
 assert.match(source,/disabled=\{busy\|\|stale\}/);
});

test('stale grant rejection and missing migration do not call unsafe legacy RPC',async()=>{
 for(const error of [new Error('AUDITOR_ACCESS_CHANGED'),Object.assign(new Error('revoke_mobile_auditor_checked not found'),{code:'PGRST202'})]){
  const h=harness();await h.load();h.requestRevoke(one);
  h.env.rpc=async(name,args)=>{h.state.calls.push({name,args});if(name==='list_mobile_auditors')return [one,two];throw error;};
  await h.revoke();assert.equal(h.state.calls.filter(c=>c.name==='revoke_mobile_auditor_checked').length,1);
  assert.equal(h.state.calls.filter(c=>c.name==='revoke_mobile_auditor').length,0);assert.equal(h.state.busy,false);
  assert.match(h.state.notice,error.code?/Falta instalar/:/ha cambiado/);
 }
});

test('list load prevents concurrent reads, validates data, and keeps unknown dates honest',async()=>{
 const h=harness(),delayed=deferred();h.env.rpc=async()=>delayed.promise;
 const first=h.load();await h.load();assert.equal(h.env.inFlight.current,true);delayed.resolve(null);await first;
 assert.equal(h.env.stale,true);assert.equal(h.state.busy,false);
 assert.equal(auditorLastAuthorization({created_at:'old',updated_at:'new'}),null);
 assert.equal(auditorLastAuthorization(one),one.last_authorized_at);
});

test('production RPC helper has bounded wait, aborts hung requests and propagates errors',async()=>{
 let signal;
 const hung={rpc:()=>({abortSignal:s=>{signal=s;return new Promise(()=>{});}})};
 await assert.rejects(auditorAdminRequest(hung,'list_mobile_auditors',{},15),/REQUEST_TIMEOUT/);assert.equal(signal.aborted,true);
 const client=value=>({rpc:()=>({abortSignal:async()=>value})});
 assert.deepEqual(await auditorAdminRequest(client({data:[one],error:null}),'list_mobile_auditors'),[one]);
 await assert.rejects(auditorAdminRequest(client({data:{error:'ADMIN_ROLE_ACCESS_DENIED'}}),'list_mobile_auditors'),/ROLE_ACCESS_DENIED/);
 await assert.rejects(auditorAdminRequest(client({error:new Error('denied')}),'list_mobile_auditors'),/denied/);
});
