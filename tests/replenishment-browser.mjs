// Built fixture + isolated local backend. No Supabase credentials or network writes.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {WAREHOUSE_DEPLOYMENTS,getWarehouseScope} from '../src/warehouse-config.mjs';
import {replenishmentKey,replenishmentDraft} from '../src/replenishment.mjs';
const playwright=process.env.PLAYWRIGHT_MODULE||'C:/Users/canpi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const {chromium}=await import(pathToFileURL(playwright));
const root=path.resolve('tmp/replenishment-integrity-browser'),tube='Tubo de silicona LSU';
const scopes=WAREHOUSE_DEPLOYMENTS.map(c=>getWarehouseScope(c.lot,c.zone));
let db,receipts,requests,lost=false,readFailure=false,changeOnRead=null,sendDelay=0,readDelay=0;
function reset(){
 db=Object.fromEntries(scopes.map(s=>[s.zone,{
  levels:Object.fromEntries(s.locations.map((l,i)=>[l,{[tube]:i?2:20,Gasas:2,'Guantes estériles':10}])),
  minimums:Object.fromEntries(s.locations.map(l=>[l,{[tube]:4,Gasas:4,'Guantes estériles':0}]))}]));
 receipts=new Map();requests=[];lost=false;readFailure=false;changeOnRead=null;sendDelay=0;readDelay=0;
}
reset();
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 const json=(data,status=200)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(data));};
 if(url.pathname==='/__test/inventory'){
  if(readDelay)await new Promise(r=>setTimeout(r,readDelay));
  if(readFailure)return json({error:'READ_FAILED'},503);
  if(changeOnRead){changeOnRead();changeOnRead=null;}
  return json(db[url.searchParams.get('zone')]);
 }
 if(url.pathname==='/__test/deliver'){
  let body='';for await(const chunk of req)body+=chunk;
  const r=JSON.parse(body);requests.push(r);
  if(sendDelay)await new Promise(resolve=>setTimeout(resolve,sendDelay));
  const prior=receipts.get(r.p_request_id);
  if(prior){assert.deepEqual(prior.request,r);return json(prior.receipt);}
  const s=scopes.find(s=>s.lot===r.p_lot&&s.zone===r.p_zone);
  assert.ok(s?.warehouseIds.includes(r.p_destination_id));
  const dest=Object.keys(s.remoteIds).find(l=>s.remoteIds[l]===r.p_destination_id),data=db[s.zone];
  assert.equal(r.p_origin_id,r.p_destination_id===s.central.id?null:s.central.id);
  for(const [m,q] of Object.entries(r.p_items)){
   assert.ok(Number.isInteger(q)&&q>0);
   if(r.p_origin_id&&data.levels[s.centralLabel][m]<q)return json({error:'Insufficient stock'},409);
  }
  for(const [m,q] of Object.entries(r.p_items)){
   if(r.p_origin_id)data.levels[s.centralLabel][m]-=q;
   data.levels[dest][m]+=q;
  }
  const receipt={request_id:r.p_request_id,confirmed_at:new Date().toISOString()};
  receipts.set(r.p_request_id,{request:r,receipt});
  if(lost){lost=false;return json({error:'SIMULATED_LOST_RESPONSE'},503);}
  return json(receipt);
 }
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
 res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');
 fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:'msedge'});
let current;
async function context(){
 const ctx=await browser.newContext({viewport:{width:390,height:844}});
 await ctx.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
 const page=await ctx.newPage();page.setDefaultTimeout(10000);current=page;
 page.on('pageerror',e=>{console.error('PAGE ERROR',e);});
 await page.goto(base+'/tests/fixtures/replenishment.html');return {ctx,page};
}
const row=(page,m)=>page.locator('.replenishment-row').filter({has:page.locator('strong',{hasText:m})});
const dismiss=async page=>{await page.getByRole('button',{name:'Entendido',exact:true}).click();};
async function choose(page,scope,id){
 const index=scopes.indexOf(scope);
 if(index){await page.getByLabel('Zona de prueba').selectOption(String(index));await page.getByRole('button',{name:'Abrir reposición'}).click();}
 await page.getByLabel('Almacén de destino').selectOption(id);
 await page.waitForFunction(()=>!document.body.innerText.includes('Actualizando existencias'));
}
async function registered(page,m){await page.waitForFunction(m=>[...document.querySelectorAll('.replenishment-row')].some(r=>r.dataset.material===m&&r.innerText.includes('Registrado')),m);}
try{
 // The exact screenshot regression in EVERY configured warehouse, including Olot/Banyoles.
 for(const scope of scopes)for(const id of scope.warehouseIds){
  reset();const label=Object.keys(scope.remoteIds).find(l=>scope.remoteIds[l]===id);db[scope.zone].levels[label][tube]=4;
  const {ctx,page}=await context();
  const draft=replenishmentDraft(scope,id,[{material:tube,replenish:2}],randomUUID());
  draft.version=1;
  await page.evaluate(({key,draft})=>localStorage.setItem(key,JSON.stringify(draft)),{key:replenishmentKey(scope,'test-owner',id),draft});
  await choose(page,scope,id);assert.equal(await row(page,tube).count(),0,`${scope.zone}/${label}: stale quantity removed`);
  assert.equal(await page.getByText(/Propuesto:/).count(),0);
  await row(page,'Gasas').getByRole('spinbutton').fill('1');
  await row(page,'Gasas').getByRole('button',{name:'Confirmar 1 unidad dejada'}).click();
  await registered(page,'Gasas');await dismiss(page);
  assert.equal(receipts.size,1);assert.equal(requests[0].p_destination_id,id);
  assert.equal(db[scope.zone].levels[label].Gasas,3);
  assert.equal(await row(page,'Gasas').getByRole('button').isDisabled(),true);
  await ctx.close();
 }
 console.log('PASS: stale v285 drafts and per-row deliveries in all '+scopes.reduce((n,s)=>n+s.warehouseIds.length,0)+' warehouses.');
 reset();const scope=scopes[0],id=scope.warehouseIds[1],label=scope.locations[1];
 let {ctx,page}=await context();await choose(page,scope,id);
 // An inventory correction made elsewhere while the dialog is open.
 changeOnRead=()=>{db[scope.zone].levels[label][tube]=4;};
 await row(page,tube).getByRole('button',{name:'Confirmar 2 unidades dejadas'}).click();await dismiss(page);
 assert.equal(receipts.size,0);assert.equal(await row(page,tube).count(),0);
 // Explicit extras, zero prevention, trash only for extras, single-click delivery.
 await page.getByRole('button',{name:'Añadir otro material',exact:true}).click();
 await page.getByLabel('Material añadido',{exact:true}).selectOption('Guantes estériles');
 await page.getByRole('button',{name:'Añadir a la lista'}).click();
 await row(page,'Guantes estériles').getByRole('spinbutton').fill('0');
 assert.equal(await row(page,'Guantes estériles').getByRole('button',{name:'Confirmar 0 unidades dejadas'}).isDisabled(),true);
 await row(page,'Guantes estériles').getByRole('button',{name:'Eliminar de la lista: Guantes estériles'}).click();
 assert.equal(await row(page,'Guantes estériles').count(),0);
 assert.equal(await row(page,'Gasas').getByRole('button',{name:/Eliminar/}).count(),0);
 // Loss after commit: close/reopen, frozen payload, retry same request, no double debit.
 lost=true;await row(page,'Gasas').getByRole('button',{name:'Confirmar 2 unidades dejadas'}).click();await dismiss(page);
 assert.equal(receipts.size,1);const requestId=requests[0].p_request_id;
 await page.getByRole('button',{name:'Guardar y continuar después'}).click();
 await page.getByRole('button',{name:'Abrir reposición'}).click();await choose(page,scope,id);
 assert.equal(await row(page,'Gasas').getByRole('spinbutton').isDisabled(),true);
 await page.getByRole('button',{name:'Reintentar confirmación'}).click();await registered(page,'Gasas');await dismiss(page);
 assert.equal(receipts.size,1);assert.equal(requests.length,2);assert.equal(requests[1].p_request_id,requestId);
 assert.equal(db[scope.zone].levels[label].Gasas,4);
 await page.screenshot({path:'tmp/replenishment-integrity-mobile.png',fullPage:true});
 await ctx.close();console.log('PASS: concurrent inventory correction, manual extras, zero, close/reopen and lost-response retry.');
 // Concurrent tabs + rapid repeat clicks share an operation id and lock.
 reset();({ctx,page}=await context());await choose(page,scope,id);
 const other=await ctx.newPage();await other.goto(base+'/tests/fixtures/replenishment.html');await choose(other,scope,id);
 sendDelay=350;
 const click=p=>row(p,'Gasas').getByRole('button',{name:'Confirmar 2 unidades dejadas'}).evaluate(button=>{button.click();button.click();});
 await Promise.all([click(page),click(other)]);
 await registered(page,'Gasas');await registered(other,'Gasas');
 assert.equal(receipts.size,1);assert.equal(requests.length,1);
 await ctx.close();console.log('PASS: two tabs and repeated click produce one server operation.');
 // Failed read must prevent writes, remain closable, preserve draft, recover.
 reset();({ctx,page}=await context());await choose(page,scope,id);
 await row(page,'Gasas').getByRole('spinbutton').fill('1');readFailure=true;
 await row(page,'Gasas').getByRole('button',{name:'Confirmar 1 unidad dejada'}).click();await dismiss(page);
 assert.equal(requests.length,0);assert.equal(await row(page,'Gasas').getByRole('spinbutton').inputValue(),'1');
 readFailure=false;await row(page,'Gasas').getByRole('button',{name:'Confirmar 1 unidad dejada'}).click();await registered(page,'Gasas');await dismiss(page);
 assert.equal(receipts.size,1);await ctx.close();console.log('PASS: failed inventory read never sends and recovery preserves quantity.');
 // Extras can exceed the minimum intentionally and submit on the first click.
 reset();({ctx,page}=await context());await choose(page,scope,id);
 await page.getByRole('button',{name:'Añadir otro material',exact:true}).click();
 await page.getByLabel('Material añadido',{exact:true}).selectOption('Guantes estériles');
 await page.getByRole('button',{name:'Añadir a la lista'}).click();
 await row(page,'Guantes estériles').getByRole('spinbutton').fill('3');
 await row(page,'Guantes estériles').getByRole('button',{name:'Confirmar 3 unidades dejadas'}).click();
 await registered(page,'Guantes estériles');await dismiss(page);
 assert.equal(db[scope.zone].levels[label]['Guantes estériles'],13);
 assert.equal(db[scope.zone].levels[scope.centralLabel]['Guantes estériles'],7);
 // A full browser store must block BEFORE the RPC.
 await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('cma_replenishment'))throw new Error('QUOTA');return window.originalSetItem.call(this,k,v);};});
 await row(page,'Gasas').getByRole('button',{name:'Confirmar 2 unidades dejadas'}).click();await dismiss(page);
 assert.equal(receipts.size,1);assert.equal(requests.length,1);
 await ctx.close();console.log('PASS: explicit extra above minimum and storage failure before send.');
 // A pending v285 batch is replayed exactly, never broken into new row ids.
 reset();({ctx,page}=await context());
 const legacy=replenishmentDraft(scope,id,[{material:tube,replenish:2},{material:'Gasas',replenish:2}],randomUUID());legacy.version=1;
 legacy.request={p_request_id:legacy.id,p_lot:scope.lot,p_zone:scope.zone,p_origin_id:scope.central.id,p_destination_id:id,p_items:{[tube]:2,Gasas:2}};
 legacy.rows[tube].checked=true;legacy.rows.Gasas.checked=false;
 await page.evaluate(({key,draft})=>localStorage.setItem(key,JSON.stringify(draft)),{key:replenishmentKey(scope,'test-owner',id),draft:legacy});
 await choose(page,scope,id);await page.getByRole('button',{name:'Reintentar confirmación'}).click();
 await registered(page,tube);await registered(page,'Gasas');await dismiss(page);
 assert.deepEqual(requests,[legacy.request]);assert.equal(receipts.size,1);
 await ctx.close();console.log('PASS: v285 batch retry registers the exact frozen payload regardless of old checkbox states.');
 console.log('ALL BROWSER CHECKS PASSED (isolated inventory only).');
}catch(error){if(current&&!current.isClosed()){console.error((await current.locator('body').innerText()).slice(-7000));await current.screenshot({path:'tmp/replenishment-integrity-failure.png',fullPage:true});}throw error;}
finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
