import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseFromWorker,freshAppUrl,pendingAuditUpdate} from '../src/app-update.mjs';
test('update detection ignores errors and parses the published worker release',()=>{
 assert.equal(releaseFromWorker('const CACHE = "cma-v999";'),999);
 assert.equal(releaseFromWorker('<html>error 503</html>'),0);
});
test('pending or unreadable audits block normal update; sent audits allow it',()=>{
 for(const [value,blocked] of [['[]',false],['[{"id":"5132"}]',true],['[{"confirmedAt":"today"}]',false],['broken',true],['{}',true]]){
  assert.equal(pendingAuditUpdate({getItem:()=>value}).blocked,blocked);
 }
});
test('fresh navigation preserves admin route and never clears saved data',()=>{
 const url=new URL(freshAppUrl('https://example.test/app/?panel=admin#reports',283));
 assert.equal(url.searchParams.get('panel'),'admin');assert.equal(url.hash,'#reports');assert.equal(url.searchParams.get('app_update'),'283');
});
