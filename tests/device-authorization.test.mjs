import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { confirmedDeviceAuthorization as confirmed } from '../src/device-authorization.mjs';
const valid = { authorized:true, enforcement_enabled:true, unit:'G453', lot:'lot5', current_version:3, device_version:3 };
test('only a confirmed authorization for the exact assignment succeeds', () => {
  assert.equal(confirmed(valid, 'G453', 'lot5'), true);
  for (const data of [null, {}, {...valid,authorized:false}, {...valid,authorized:'true'},
    {...valid,enforcement_enabled:false}, {...valid,unit:'G452'}, {...valid,lot:'lot7'},
    {...valid,device_version:2}, {...valid,current_version:undefined}]) {
    assert.equal(confirmed(data, 'G453', 'lot5'), false);
  }
});
test('activation UI never announces success before the second server confirmation', async () => {
  const source=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
  const body=source.split('  async function activateThisDevice(replacementConfirmed = false) {')[1].split('  async function prepareDeviceGuard')[0];
  const factory=new Function('env', `with(env) {return async function(replacementConfirmed = false) {${body.slice(0,body.lastIndexOf('}'))}}}`);
  for(const response of [valid, null, {...valid,authorized:false}, {...valid,unit:'G452'}]) {
    const messages=[]; const storage=new Map([['unit','G453'],['lot','lot5']]);
    let calls=0, authorized=false;
    const env={localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},KEY:{unit:'unit',lot:'lot'},
      lot:'lot5',flash:m=>messages.push(m), getRecords:()=>[], deviceActivationCode:'12345678',setDeviceAuthLoading:()=>{},
      deviceAuthSequence:{current:0}, ensureAnonymousSession:async()=>({user:{id:'test-device'}}),GUARD_HANDOFF_KEY:'handoff',displayUnit:u=>u,
      classifyPendingRecords:()=>({matching:[],foreign:[]}),pendingUnitsLabel:()=>'',
      supabase:{rpc:async(name)=>({data:name==='get_device_activation_preview'?{replacement_required:false}:++calls===1?valid:response})},confirmedDeviceAuthorization:confirmed,
      prepareDeviceGuard:async()=>{},setDeviceAuth:s=>{authorized=s.authorized},DEVICE_AUTH_CACHE:'cache',
      rememberAuthorizedIdentity:()=>{},rememberRecoverySession:async()=>true,resolveAuthDiagnostic:()=>{},
      setDeviceActivationCode:()=>{},setDeviceActivationOpen:()=>{},setDeviceReplacementOpen:()=>{},setDeviceReplacementUnitInput:()=>{}, recoveryErrorMessage:e=>String(e)};
    await factory(env)();
    assert.equal(messages.includes('Dispositivo autorizado correctamente'),response===valid);
    assert.equal(authorized,response===valid);
  }
  const save=source.split('  async function saveUnit() {')[1].split('  const filtered')[0];
  assert.match(save,/refreshDeviceAuthorization\(unit\)/);
  assert.match(save,/setDeviceActivationOpen\(true\)/);
  assert.ok(save.indexOf('localStorage.setItem(KEY.unit, unit)') < save.indexOf('setDeviceActivationOpen(true)'));
});
