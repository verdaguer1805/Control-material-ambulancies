const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {auditItems} from '../../src/vehicle-audit.mjs';
const root=path.resolve('dist-auditor-reopen-check');
const server=http.createServer(async(req,res)=>{try{const target=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!target.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'})[path.extname(target)]||'application/octet-stream');res.end(await readFile(target));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(5216,'127.0.0.1',resolve));
const base='http://127.0.0.1:5216',prefix='cma_named_auditor_demo:';
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 for(const type of ['SVB','SVB 4x4','Polivalente','TSNU']){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.route('**/*.supabase.co/**',r=>r.abort());
  let page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/named-auditor-preview.html');
  const original=await page.evaluate(async({type,prefix,initialCatalog})=>{
   const p={user_id:'jordi-local',full_name:'Jordi Ventura Rodeja',lot:'Lot 5 · Girona - Alt Maresme',zone:'Olot',warehouse_id:'example-olot',warehouse_name:'Olot central',revision:7,active:false,verified:false};
   // Frozen older catalog: omit a newly added bag item and preserve an older label.
   const catalog=initialCatalog.slice(0,-1);
   const selected=catalog.find(i=>i.id.startsWith('Zona frontal-10-'))||catalog[0];
   selected.label+=' (plantilla anterior)';
   const row={id:'audit-5132-local',user_id:p.user_id,profile_revision:7,full_name:p.full_name,lot:p.lot,zone:p.zone,warehouse_id:p.warehouse_id,vehicle:type==='TSNU'?'T1739':'5132',checklist_type:type,catalog,answers:{[selected.id]:'issue'},notes:{[selected.id]:'Conservar nota anterior'},edit_version:4,started_at:'2026-11-25T12:00:00Z'};
   const draft={id:row.id,auditorUserId:p.user_id,profileRevision:7,warehouseId:p.warehouse_id,supervisor:`Auditor · ${p.zone} · ${p.full_name}`,lot:p.lot,zone:p.zone,vehicle:row.vehicle,type,catalog,answers:row.answers,notes:row.notes,editVersion:4,startedAt:row.started_at,confirmedAt:null};
   for(const key of Object.keys(localStorage))if(key.startsWith(prefix))localStorage.removeItem(key);
   localStorage.setItem(prefix+'server',JSON.stringify({profile:p,audits:[row],receipts:[]}));
   localStorage.setItem(prefix+'cma_supervisor_vehicle_audits_v1',JSON.stringify([draft]));
   return draft;
  },{type,prefix,initialCatalog:auditItems(type,type==='TSNU'?'T1739':'5132')});
  await page.reload();await page.getByRole('button',{name:'Aceptar',exact:true}).click();
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(300);assert.equal(await page.locator('dialog[open]').count(),0,'cancel must not reopen the inactive modal');
  await page.getByRole('button',{name:'Volver a verificar',exact:true}).click();
  await page.getByRole('button',{name:'Aceptar',exact:true}).click();
  await page.getByLabel('Código del propietario o supervisor de esta zona').fill('wrong-local');
  await page.getByRole('button',{name:'Autorizar y confirmar almacén',exact:true}).click();
  await page.getByRole('button',{name:'Aceptar',exact:true}).click();
  await page.getByLabel('Código del propietario o supervisor de esta zona').fill('local-test');
  await page.getByRole('button',{name:'Autorizar y confirmar almacén',exact:true}).click();
  await page.getByRole('button',{name:'Aceptar',exact:true}).click();
  await page.getByRole('button',{name:'Continuar auditoría pendiente',exact:true}).click();
  const read=()=>page.evaluate(prefix=>({confirmedAt:null,...JSON.parse(localStorage.getItem(prefix+'cma_supervisor_vehicle_audits_v1'))[0]}),prefix);
  assert.deepEqual(await read(),original);
  await page.close();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/named-auditor-preview.html');
  await page.getByRole('button',{name:'Continuar auditoría pendiente',exact:true}).click();
  assert.deepEqual(await read(),original,'close/reopen must keep catalog, marks, notes and id');
  if(type.startsWith('SVB')){
   await page.getByRole('button',{name:/Zona frontal/}).click();
   await page.getByRole('button',{name:/Zona frontal · Compartimento 10/}).click();
   await page.getByRole('button',{name:/Correcto:.*plantilla anterior/}).click();
  }else if(type==='TSNU'){
   await page.locator('summary').first().click();await page.getByLabel(original.catalog[0].label,{exact:true}).selectOption('ok');
  }else{
   await page.getByRole('button',{name:/Zona izquierda/}).click();
   await page.getByRole('button',{name:/Zona izquierda · Punto 1/}).click();
   await page.getByRole('button',{name:/Correcto:.*plantilla anterior/}).click();
  }
  const after=await read();assert.equal(after.answers[Object.keys(original.answers)[0]],'ok');assert.deepEqual(after.catalog,original.catalog);assert.deepEqual(after.notes,original.notes);
  await page.close();page=await context.newPage();await page.goto(base+'/named-auditor-preview.html');await page.getByRole('button',{name:'Continuar auditoría pendiente',exact:true}).click();
  assert.deepEqual(await read(),after);assert.deepEqual(errors,[]);
  console.log('PASS',type,'inactive > cancel without loop > wrong code rejected > reauthorize > frozen catalog > close/reopen > edit > close/reopen');
  await context.close();
 }
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.route('**/sw.js',r=>r.fulfill({status:200,contentType:'text/javascript',body:'const CACHE = "cma-v999";'}));
 await context.route('**/*.supabase.co/**',r=>r.abort());
 const page=await context.newPage();await page.goto(base+'/named-auditor-preview.html');
 const saved='[{"id":"5132","catalog":[{"id":"original","label":"Material anterior"}],"answers":{"original":"issue"},"notes":{"original":"Guardar"}}]';
 await page.evaluate(saved=>localStorage.setItem('cma_supervisor_vehicle_audits_v1',saved),saved);await page.reload();
 const normal=page.getByRole('button',{name:'Actualizar aplicación',exact:true});await normal.waitFor();assert.equal(await normal.isDisabled(),true);
 await page.getByRole('button',{name:'No puedo terminar: recuperar mediante actualización'}).click();
 const recovery=page.getByRole('button',{name:'Actualizar para recuperar',exact:true});assert.equal(await recovery.isDisabled(),true);
 await page.getByRole('checkbox',{name:'Un error me impide terminar la auditoría.'}).check();
 await recovery.click();await page.waitForURL('**app_update=999');
 assert.equal(await page.evaluate(()=>localStorage.getItem('cma_supervisor_vehicle_audits_v1')),saved);
 await page.evaluate(()=>localStorage.setItem('cma_supervisor_vehicle_audits_v1','[{"confirmedAt":"2026-11-26"}]'));await page.reload();await normal.waitFor();assert.equal(await normal.isEnabled(),true);
 console.log('PASS update: pending blocks normal reload; recovery requires confirmation; reload preserves complete draft; completed allows normal update');await context.close();
}finally{await browser.close();server.close();}
