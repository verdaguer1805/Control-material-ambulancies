import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {chromium} from 'file:///C:/Users/canpi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {SVB_LEFT_WALL_SECTIONS as left} from '../public/checklists/svb-left-wall-data.js';
import {SVB_FRONT_WALL_SECTIONS as front} from '../public/checklists/svb-front-wall-data.js';
import {svbRightSections} from '../public/checklists/svb-template.js';
import {SVB_DOOR_SECTIONS as door} from '../public/checklists/svb-door-data.js';
import {SVB_CABIN_ITEMS as cabin} from '../public/checklists/svb-cabin-data.js';
import {BP_ITEMS,bpDraftKey} from '../src/bp-operational.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
console.log('Starting local test server');
const server=await createServer({root,configFile:false,optimizeDeps:{entries:['tests/checklist-pending-fixture.html']},server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();
const base=`http://127.0.0.1:${server.httpServer.address().port}`;
console.log('Starting local test browser',base);
const browser=await chromium.launch({headless:true,channel:'msedge'});
let checks=0;const pass=name=>{checks++;console.log('PASS',name)};
const mark=ss=>Object.fromEntries(ss.filter(s=>!s.pendingDefinition).map(s=>[s.id,Object.fromEntries((s.groups?s.groups.flatMap(g=>g.items):s.items).map(i=>[i,'ok']))]));
const unitContext={unit:'G450',lot:'Lot 5 · Girona - Alt Maresme',zone:'Olot',checklist:'SVB',svbVariant:'SVB',guardCode:'261126',guardStartedAt:'2026-11-26T06:00:00Z'};
const pendingKeys=p=>p.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('cma_checklist_pending_v1:')));
const ack=async p=>{const b=p.getByRole('button',{name:'Entendido',exact:true});if(await b.isVisible())await b.click();};
async function setup({mode='network',kind='svb',type='SVB',version=2}={}){
 console.log('Scenario',kind,type,version,mode);
 const bc=await browser.newContext({viewport:{width:390,height:844}}),state={mode,calls:[],releases:[],records:new Map()};bc.setDefaultTimeout(12000);
 await bc.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin===base&&/^\/src\/supabase(?:\.js)?$/.test(url.pathname))return route.fulfill({contentType:'application/javascript',body:`export const ensureAnonymousSession=async()=>{};export const supabase={rpc:(name,args)=>({abortSignal:async signal=>{const response=await fetch('/__rpc',{method:'POST',body:JSON.stringify({name,args}),signal});return response.json();}})};`});
  if(url.pathname==='/__rpc'||url.pathname==='/rest/v1/rpc/submit_svb_checklist'){
   const native=url.pathname==='/__rpc',request=route.request().postDataJSON(),name=native?request.name:'submit_svb_checklist',args=native?request.args:request;
   state.calls.push({name,args});
   if(state.mode==='network')return route.abort('internetdisconnected');
   if(state.mode==='hang')await new Promise(resolve=>state.releases.push(resolve));
   const receipt=name==='submit_tsnu_checklist'?{checklist_submitted_at:'2026-11-26T10:00:00Z'}:{submitted_at:'2026-11-26T10:00:00Z'};
   const data=state.mode==='no-receipt'?{}:receipt;
   if(state.mode==='success')state.records.set(args.p_shift_id||args.p_guard_code+':'+args.p_vehicle_label,args);
   try{await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(native?{data,error:null}:data)});}catch{}return;
  }
  if(url.origin!==base)throw new Error('Unexpected external request '+url);
  return route.continue();
 });
 const answers={left:mark(left),front:mark(front),right:mark(svbRightSections(type,version)),door:mark(door),cabin:{1:Object.fromEntries(cabin.map(i=>[i,'ok']))}};
 const bp={unit:'BP50',lot:'Test lot',zone:'Test zone',vehicle:'5439',guardCode:'261126',guardStartedAt:'2026-11-26T06:00:00.000Z',catalog:BP_ITEMS,answers:Object.fromEntries(BP_ITEMS.map(i=>[i.id,'ok'])),notes:{}};
 await bc.addInitScript(({kind,type,version,unitContext,answers,bp,bpKey})=>{
  if(localStorage.getItem('test-initialized'))return;localStorage.setItem('test-initialized','1');
  if(kind==='svb'){
   localStorage.setItem('cma_svb_checklist_context_v1',JSON.stringify(unitContext));localStorage.setItem('cma_svb_vehicle_label_v2:G450','5439');
   localStorage.setItem('cma_svb_template_v1:'+unitContext.lot+':G450:261126:5439',type);
   if(version===2)localStorage.setItem('cma_svb_right_version_v1:'+unitContext.lot+':G450:261126:5439','2');
   localStorage.setItem('sb-dfnywetqnccykzjyihzq-auth-token',JSON.stringify({access_token:'local-token'}));
   for(const [z,a] of Object.entries(answers))localStorage.setItem(`cma_svb_${z}_${z==='right'?'zone':'wall'}_mobile_test_v1:G450:261126:5439`,JSON.stringify(a));
  }else if(kind==='bp'){
   localStorage.setItem('cma_svb_vehicle_label_v2:BP50','5439');localStorage.setItem(bpKey,JSON.stringify(bp));
  }else{
   localStorage.setItem('cma_tsnu_active_shift_v1',JSON.stringify({unit:'T9999',lot:'Test lot',zone:'Test zone',sessionId:'local-tsnu-id',id:'local-tsnu-id',date:'2026-11-26',startedAt:'2026-11-26T08:00:00Z',vehicleType:'TSNU',completed:true,answers:{item:'ok'}}));
   localStorage.setItem('cma_tsnu_outbox_v1',JSON.stringify([{localId:'checklist:local-tsnu-id',shiftId:'local-tsnu-id',unit:'T9999',lot:'Test lot',zone:'Test zone',startedAt:'2026-11-26T08:00:00Z',type:'checklist',answers:{item:'ok'}}]));
  }
 },{kind,type,version,unitContext,answers,bp,bpKey:bpDraftKey(bp)});
 const open=async(time='2026-11-26T10:00:00Z')=>{const p=await bc.newPage();await p.clock.install({time:new Date(time)});p.on('pageerror',e=>console.log('PAGE ERROR',e.message));await p.goto(kind==='svb'?base+'/svb-zones.html':base+`/tests/checklist-pending-fixture.html?mode=${kind}`,{waitUntil:'domcontentloaded'});return p;};
 return {bc,state,open,page:await open(),close:async()=>{state.releases.splice(0).forEach(f=>f());await bc.close();}};
}
try{
 for(const [type,version] of [['SVB',2],['SVB',1],['SVB 4x4',1]]){
  const c=await setup({type,version});let p=c.page;
  await p.getByRole('button',{name:'Enviar checklist',exact:true}).click();
  await p.getByRole('dialog',{name:'Checklist pendiente de confirmar',exact:true}).waitFor();assert.equal((await pendingKeys(p)).length,1);
  if(type==='SVB'&&version===2)await p.screenshot({path:fileURLToPath(new URL('../tmp/checklist-pending-modal.png',import.meta.url))});
  await ack(p);
  if(type==='SVB'&&version===2)await p.screenshot({path:fileURLToPath(new URL('../tmp/checklist-pending-banner.png',import.meta.url))});
  await p.evaluate(()=>{dispatchEvent(new Event('online'));dispatchEvent(new Event('focus'));});
  assert.match(await p.locator('#submitStatus').innerText(),/pendiente de confirmar/);
  await p.close();p=await c.open();await p.getByRole('dialog',{name:'Checklist pendiente de confirmar',exact:true}).waitFor();await ack(p);
  assert.match(await p.locator('#submitStatus').innerText(),/G450.*5439.*26\/11\/2026/);
  await p.goto(base+'/tests/checklist-pending-fixture.html?mode=entry');await p.locator('[data-checklist-pending-banner]').waitFor();await ack(p);
  assert.match(await p.locator('[data-checklist-pending-banner]').innerText(),/5439/);
  await p.goto(base+'/svb-zones.html');await ack(p);c.state.mode='success';await p.locator('#submitChecklist').click();
  await p.getByText('✓ Checklist enviado y confirmado correctamente.',{exact:true}).waitFor();assert.equal((await pendingKeys(p)).length,0);
  assert.deepEqual(c.state.calls[0].args,c.state.calls.at(-1).args);assert.equal(c.state.records.size,1);
  await p.reload();assert.equal(await p.locator('dialog[data-checklist-pending]').count(),0);assert.match(await p.locator('#submitStatus').innerText(),/confirmado correctamente/);
  pass(`Offline / close / reopen / app entry / identical retry / confirmed cleanup: ${type} catalog ${version}`);await c.close();
 }
 {
  const c=await setup({mode:'hang'});await c.page.getByRole('button',{name:'Enviar checklist',exact:true}).click();
  assert.equal((await pendingKeys(c.page)).length,1);await c.page.clock.fastForward(21000);
  await c.page.getByRole('dialog',{name:'Checklist pendiente de confirmar',exact:true}).waitFor();await ack(c.page);assert.match(await c.page.locator('#submitStatus').innerText(),/pendiente/);
  await c.page.close();const p=await c.open('2026-11-27T06:00:00Z');await p.getByRole('dialog',{name:'Checklist pendiente de confirmar',exact:true}).waitFor();await ack(p);
  assert.match(await p.locator('#submitStatus').innerText(),/plazo ha terminado/);assert(await p.locator('#submitChecklist').isDisabled());assert.equal((await pendingKeys(p)).length,1);
  pass('Timeout and guard rollover preserve pending warning without moving/resending old checklist');await c.close();
 }
 {
  const c=await setup({mode:'hang'});await c.page.getByRole('button',{name:'Enviar checklist',exact:true}).click();await c.page.close();
  const p=await c.open();await p.getByRole('dialog',{name:'Checklist pendiente de confirmar',exact:true}).waitFor();assert.equal((await pendingKeys(p)).length,1);
  pass('Closing while request is still in flight preserves warning');await c.close();
 }
 {
  const c=await setup({mode:'success'});await c.page.getByRole('button',{name:'Enviar checklist',exact:true}).click();await c.page.getByText('✓ Checklist enviado y confirmado correctamente.',{exact:true}).waitFor();
  await c.page.evaluate(()=>{const k='cma_svb_right_zone_mobile_test_v1:G450:261126:5439',a=JSON.parse(localStorage.getItem(k));a['7'][Object.keys(a['7'])[0]]='issue';localStorage.setItem(k,JSON.stringify(a));});
  c.state.mode='network';await c.page.reload();await c.page.getByRole('button',{name:'Reenviar checklist',exact:true}).click();await ack(c.page);await c.page.reload();await ack(c.page);
  assert.match(await c.page.locator('#submitStatus').innerText(),/pendiente de confirmar/);assert.doesNotMatch(await c.page.locator('#submitStatus').innerText(),/enviado y confirmado correctamente/);
  pass('Failed edited resend never shows previous confirmation as confirmation of new changes');await c.close();
 }
 {
  const c=await setup({mode:'success'});await c.page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('cma_checklist_pending_v1:'))throw new Error('QuotaExceededError');return original.call(this,k,v);};});
  await c.page.getByRole('button',{name:'Enviar checklist',exact:true}).click();await c.page.getByRole('dialog',{name:'Checklist pendiente de confirmar',exact:true}).waitFor();
  assert.equal(c.state.calls.length,0);assert.match(await c.page.locator('dialog[data-checklist-pending]').innerText(),/No se ha podido guardar/);
  pass('Storage failure prevents HTTP and displays durable-on-screen warning without erasing answers');await c.close();
 }
 {
  const c=await setup({kind:'bp'});let p=c.page;await p.getByRole('button',{name:'Checklist BP · Polivalente',exact:true}).click();await p.getByRole('button',{name:'Enviar checklist',exact:true}).click();
  await p.getByRole('dialog',{name:'Checklist pendiente de confirmar',exact:true}).waitFor();await ack(p);assert.equal((await pendingKeys(p)).length,1);await p.reload();
  await p.locator('[data-checklist-pending-banner]').waitFor();await ack(p);await p.getByRole('button',{name:'Checklist BP · Polivalente',exact:true}).click();
  c.state.mode='success';await p.getByRole('button',{name:'Finalizar y enviar checklist',exact:true}).click();await p.getByText('Checklist enviado y confirmado.',{exact:true}).waitFor();
  assert.equal((await pendingKeys(p)).length,0);assert.equal(await p.locator('[data-checklist-pending-banner]').count(),0);assert.deepEqual(c.state.calls[0],c.state.calls.at(-1));
  pass('BP persistent failure, closed/open component, reloaded app and confirmed identical retry');await c.close();
 }
 {
  const c=await setup({kind:'tsnu'});let p=c.page;await p.locator('[data-checklist-pending-banner]').waitFor();await ack(p);await p.clock.fastForward(6000);
  assert.equal(await p.locator('[data-checklist-pending-banner]').count(),1);await p.reload();await p.locator('[data-checklist-pending-banner]').waitFor();await ack(p);
  c.state.mode='no-receipt';await p.getByRole('button',{name:'Reintentar envío del checklist',exact:true}).click();await p.waitForFunction(()=>JSON.parse(localStorage.getItem('cma_tsnu_outbox_v1'))[0]?.lastSyncError==='CHECKLIST_CONFIRMATION_MISSING');
  assert.equal(await p.locator('[data-checklist-pending-banner]').count(),1);const closeNotice=p.getByRole('button',{name:'Cerrar',exact:true}).last();if(await closeNotice.isVisible())await closeNotice.click();
  await ack(p);c.state.mode='success';await p.getByRole('button',{name:'Reintentar envío del checklist',exact:true}).click();await p.waitForFunction(()=>JSON.parse(localStorage.getItem('cma_tsnu_outbox_v1')).length===0);
  assert.equal(await p.locator('[data-checklist-pending-banner]').count(),0);assert(c.state.calls.every(call=>call.args.p_shift_id==='local-tsnu-id'));
  pass('TSNU warning survives transient notices/reload; missing receipt retains queue; valid confirmation clears it');await c.close();
 }
 console.log(JSON.stringify({checks,productionWrites:0}));
}catch(error){console.error(error);throw error;}finally{await browser.close();await server.close();}
