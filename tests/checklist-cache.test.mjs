import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('all public checklist scripts, imports and zone navigation use the current release URL',()=>{
 const files=['svb-zones.html','svb-preview.html','svb-front-preview.html','svb-right-preview.html','svb-cabin.html','checklists/svb-zones-production.js','checklists/svb-cabin.js'];
 for(const file of files){
  const source=fs.readFileSync(new URL(`../public/${file}`,import.meta.url),'utf8');
  const routes=[...source.matchAll(/["'](\.\/(?:checklists\/)?[a-zA-Z0-9-]+\.(?:html|js)(?:\?[^"']*)?)["']/g)].map(m=>m[1]);
  assert.ok(routes.length>0,file);
  for(const route of routes)assert.ok(route.endsWith('?v=219'),`${file}: ${route}`);
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
 const context={URL,Request:WorkerRequest,Response,caches:{open:async()=>workerCache,match:async key=>stored.get(typeof key==='string'?key:key.url),keys:async()=>['cma-v219'],delete:async()=>true},fetch:async request=>{requests.push(request);if(offline)throw new TypeError('offline');return new Response('new release');},self:{location:{origin},skipWaiting(){},clients:{claim(){}},addEventListener:(name,handler)=>{handlers[name]=handler;}}};
 vm.runInNewContext(fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),context);
 let installation;handlers.install({waitUntil:promise=>{installation=promise;}});await installation;
 assert.ok(requests.every(request=>request.cache==='reload'));
 let result;
 handlers.fetch({request:new WorkerRequest(origin+'/app/checklists/svb-left-wall-data.js?v=219'),respondWith:promise=>{result=promise;}});
 assert.equal(await (await result).text(),'new release');assert.equal(requests.at(-1).cache,'no-cache');
 offline=true;
 handlers.fetch({request:new WorkerRequest(origin+'/app/checklists/svb-zones-production.js?v=219'),respondWith:promise=>{result=promise;}});
 assert.equal(await (await result).text(),'new release');
 handlers.fetch({request:new WorkerRequest(origin+'/app/svb-zones.html?from=pwa-v219',{mode:'navigate'}),respondWith:promise=>{result=promise;}});
 assert.equal(await (await result).text(),'new release');
});
