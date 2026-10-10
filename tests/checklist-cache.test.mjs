import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const main=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const release=main.match(/className="app-version">v(\d+)</)[1];

test('home, worker, checklist headings and registration must belong to the same release',()=>{
 const worker=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
 assert.ok(worker.includes(`const CACHE = "cma-v${release}"`));
 assert.ok(main.includes(`./sw.js?v=${release}`));
 assert.ok(main.includes(`./svb-zones.html?from=pwa-v${release}`));
 for(const file of ['svb-zones.html','svb-preview.html','svb-front-preview.html','svb-right-preview.html','svb-door-preview.html']){
  const html=fs.readFileSync(new URL(`../public/${file}`,import.meta.url),'utf8');
  assert.ok(html.includes(`<small>v${release}</small>`),`${file}: heading differs from home`);
 }
 for(const file of ['checklists/svb-zones-production.js','svb-preview.html','svb-front-preview.html','svb-right-preview.html','svb-door-preview.html']){
  const source=fs.readFileSync(new URL(`../public/${file}`,import.meta.url),'utf8');
  assert.ok(source.includes(`textContent="v${release}"`),`${file}: runtime heading differs from home`);
 }
 const workflow=fs.readFileSync(new URL('../.github/workflows/deploy-pages.yml',import.meta.url),'utf8');
 assert.ok(workflow.indexOf('npm run test:release')>0);
 assert.ok(workflow.indexOf('npm run test:release')<workflow.indexOf('npm run build'));
});

test('all public checklist scripts, imports and zone navigation use the current release URL',()=>{
 const files=['svb-zones.html','svb-preview.html','svb-front-preview.html','svb-right-preview.html','svb-cabin.html','svb-door-preview.html','checklists/svb-zones-production.js','checklists/svb-cabin.js'];
 for(const file of files){
  const source=fs.readFileSync(new URL(`../public/${file}`,import.meta.url),'utf8');
  const routes=[...source.matchAll(/["'](\.\/(?:checklists\/)?[a-zA-Z0-9-]+\.(?:html|js)(?:\?[^"']*)?)["']/g)].map(m=>m[1]);
  assert.ok(routes.length>0,file);
  for(const route of routes)assert.ok(route.endsWith(`?v=${release}`),`${file}: ${route}`);
 }
});

test('worker installation bypasses stale HTTP cache and versioned code remains available offline',async()=>{
 const handlers={},stored=new Map(),requests=[];
 const origin='https://example.test';
 class WorkerRequest {
  constructor(input,init={}){const original=typeof input==='string'?{url:new URL(input,origin+'/app/').href}:input;Object.assign(this,{method:'GET',mode:'cors'},original,init);}
 }
 const workerCache={addAll:async values=>{requests.push(...values);for(const request of values)stored.set(request.url,new Response('new release'));},put:async(request,response)=>stored.set(request.url,response)};
 let offline=false;
 const context={URL,Request:WorkerRequest,Response,caches:{open:async()=>workerCache,match:async key=>stored.get(typeof key==='string'?key:key.url),keys:async()=>['cma-v223'],delete:async()=>true},fetch:async request=>{requests.push(request);if(offline)throw new TypeError('offline');return new Response('new release');},self:{location:{origin},skipWaiting(){},clients:{claim(){}},addEventListener:(name,handler)=>{handlers[name]=handler;}}};
 vm.runInNewContext(fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),context);
 let installation;handlers.install({waitUntil:promise=>{installation=promise;}});await installation;
 assert.ok(requests.every(request=>request.cache==='reload'));
 let result;
 handlers.fetch({request:new WorkerRequest(origin+'/app/checklists/svb-left-wall-data.js?v=223'),respondWith:promise=>{result=promise;}});
 assert.equal(await (await result).text(),'new release');assert.equal(requests.at(-1).cache,'no-cache');
 offline=true;
 handlers.fetch({request:new WorkerRequest(origin+'/app/checklists/svb-zones-production.js?v=223'),respondWith:promise=>{result=promise;}});
 assert.equal(await (await result).text(),'new release');
 handlers.fetch({request:new WorkerRequest(origin+'/app/svb-zones.html?from=pwa-v223',{mode:'navigate'}),respondWith:promise=>{result=promise;}});
 assert.equal(await (await result).text(),'new release');
});
