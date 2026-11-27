const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

// Isolated fixture only: all Supabase requests are blocked and no real data is loaded.
const root=path.resolve('dist-auditor-reopen-check'),prefix='cma_named_auditor_demo:';
const server=http.createServer(async(req,res)=>{try{
 const target=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!target.startsWith(root+path.sep))throw Error();
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg'})[path.extname(target)]||'application/octet-stream');
 res.end(await readFile(target));
}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 for(const [lot,zone,warehouse] of [['Lot 5 · Girona - Alt Maresme','Olot','example-olot'],['Other lot','Figueres','example-fig']]){
  const context=await browser.newContext({viewport:{width:390,height:844}}),errors=[];
  await context.route('**/*.supabase.co/**',r=>r.abort());
  let page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/named-auditor-preview.html');
  await page.evaluate(({prefix,lot,zone,warehouse})=>{
   for(const key of Object.keys(localStorage))if(key.startsWith(prefix))localStorage.removeItem(key);
   const profile={user_id:'test-mobile-authorization',full_name:'Test Auditor Person',lot,zone,warehouse_id:warehouse,warehouse_name:'Test central',revision:9,active:true,verified:true};
   localStorage.setItem(prefix+'server',JSON.stringify({profile,audits:[],receipts:[]}));
  },{prefix,lot,zone,warehouse});
  await page.reload();await page.getByText('Simulación · Asignación validada del ejemplo',{exact:true}).waitFor();
  await page.getByText('Referencia del móvil: test-mob',{exact:true}).waitFor();
  const identityBefore=await page.evaluate(prefix=>localStorage.getItem(prefix+'cma_authorized_auth_identity_v1'),prefix);
  await page.getByRole('button',{name:'Cambiar perfil',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'¿Cambiar el perfil de este móvil?'});await dialog.waitFor();
  assert.match(await dialog.innerText(),/Test Auditor Person/);assert.match(await dialog.innerText(),/Móvil test-mob/);
  assert.match(await dialog.innerText(),/cierra la aplicación: conservarás el permiso/);
  await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
  assert.equal(await page.evaluate(prefix=>JSON.parse(localStorage.getItem(prefix+'server')).profile.active,prefix),true);
  assert.equal(await page.evaluate(prefix=>localStorage.getItem(prefix+'cma_authorized_auth_identity_v1'),prefix),identityBefore);
  await page.getByRole('button',{name:'Cambiar perfil',exact:true}).click();
  await page.getByRole('dialog',{name:'¿Cambiar el perfil de este móvil?'}).waitFor();await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog[open]').count(),0);
  assert.equal(await page.evaluate(prefix=>JSON.parse(localStorage.getItem(prefix+'server')).profile.active,prefix),true);
  assert.equal(await page.evaluate(prefix=>localStorage.getItem(prefix+'cma_authorized_auth_identity_v1'),prefix),identityBefore);
  // Closing the app while a confirmation is open is not consent to revoke.
  await page.getByRole('button',{name:'Cambiar perfil',exact:true}).click();
  await page.getByRole('dialog',{name:'¿Cambiar el perfil de este móvil?'}).waitFor();
  await page.close();page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/named-auditor-preview.html');await page.getByText('Simulación · Asignación validada del ejemplo',{exact:true}).waitFor();
  assert.equal(await page.locator('dialog[open]').count(),0);
  assert.equal(await page.evaluate(prefix=>localStorage.getItem(prefix+'cma_authorized_auth_identity_v1'),prefix),identityBefore);
  const originalProfile=await page.evaluate(prefix=>JSON.parse(localStorage.getItem(prefix+'server')).profile,prefix);
  await page.getByRole('button',{name:'Cambiar zona',exact:true}).click();
  await page.getByRole('heading',{name:'Cambiar asignación',exact:true}).waitFor();
  await page.getByLabel('Nombre y apellidos',{exact:true}).fill('Unconfirmed Other Person');
  await page.locator('form label').filter({hasText:/^Zona/}).locator('select').selectOption(zone==='Olot'?'Figueres':'Olot');
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.getByText('Simulación · Asignación validada del ejemplo',{exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(prefix=>JSON.parse(localStorage.getItem(prefix+'server')).profile,prefix),originalProfile);
  await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));});
  await page.getByText('Simulación · Asignación validada del ejemplo',{exact:true}).waitFor();
  assert.equal(await page.locator('dialog[open]').count(),0);
  assert.equal(await page.getByRole('button',{name:'Auditar vehículo',exact:true}).isEnabled(),true);
  assert.equal(await page.locator('.material .counter button').first().isEnabled(),true);
  assert.equal(await page.evaluate(prefix=>localStorage.getItem(prefix+'cma_authorized_auth_identity_v1'),prefix),identityBefore);
  // A rejected reassignment must not strand an otherwise authorized auditor.
  await page.getByRole('button',{name:'Cambiar zona',exact:true}).click();
  await page.getByRole('heading',{name:'Cambiar asignación',exact:true}).waitFor();
  await page.getByLabel('Código del propietario o supervisor de esta zona').fill('wrong-local');
  await page.getByRole('button',{name:'Autorizar y confirmar almacén',exact:true}).click();
  await page.getByRole('button',{name:'Aceptar',exact:true}).click();
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.getByText('Simulación · Asignación validada del ejemplo',{exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(prefix=>JSON.parse(localStorage.getItem(prefix+'server')).profile,prefix),originalProfile);
  assert.equal(await page.locator('.material .counter button').first().isEnabled(),true);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.getByText('Simulación · Asignación validada del ejemplo',{exact:true}).waitFor();
  assert.equal(await page.locator('dialog[open]').count(),0);
  await page.getByRole('button',{name:'Cambiar perfil',exact:true}).click();
  await page.getByRole('button',{name:'Sí, cambiar perfil',exact:true}).click();
  await page.getByRole('heading',{name:'Selector de perfil · Simulación local',exact:true}).waitFor();
  assert.equal(await page.evaluate(prefix=>JSON.parse(localStorage.getItem(prefix+'server')).profile.active,prefix),false);
  assert.equal(await page.evaluate(prefix=>localStorage.getItem(prefix+'cma_authorized_auth_identity_v1'),prefix),null);
  await page.close();page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/named-auditor-preview.html');await page.getByRole('button',{name:'Aceptar',exact:true}).click();
  await page.getByRole('heading',{name:'Recuperar autorización del móvil',exact:true}).waitFor();
  await page.getByText('Referencia del móvil: test-mob',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('Nombre y apellidos',{exact:true}).inputValue(),'Test Auditor Person');
  assert.deepEqual(errors,[]);
  console.log('PASS',lot,zone,'Cancel/Escape/close with confirmation open preserve access; zone edits and rejected code cancelled preserve usable assignment without focus loop; confirmed leave deactivates only this phone; reopen offers recovery');
  await context.close();
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
