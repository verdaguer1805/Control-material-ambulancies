import test from 'node:test';
import assert from 'node:assert/strict';
import {getWarehouseScope,WAREHOUSE_DEPLOYMENTS} from '../src/warehouse-config.mjs';
import {replenishmentKey,replenishmentDraft,replenishmentRequest,replenishmentItems,replenishmentShortages,boundedReplenishment,validReplenishmentQuantity,editReplenishmentRow} from '../src/replenishment.mjs';
import fs from 'node:fs';
import {canRemoveReplenishmentRow,removeReplenishmentRow} from '../src/replenishment.mjs';
test('trash removes only explicit manual additions, never proposals, legacy rows or pending sends',()=>{
 const draft={id:'same',request:null,rows:{Auto:{quantity:'2',checked:false},Legacy:{quantity:'1',checked:false},Extra:{quantity:'3',checked:true,manual:true}}};
 for(const m of ['Auto','Legacy']){
  assert.equal(canRemoveReplenishmentRow(draft,m),false);
  assert.equal(removeReplenishmentRow(draft,m),draft);
 }
 const removed=removeReplenishmentRow(draft,'Extra');
 assert.deepEqual(Object.keys(removed.rows),['Auto','Legacy']);
 assert.equal(removed.id,draft.id);assert.ok(draft.rows.Extra);
 assert.equal(removeReplenishmentRow(draft,'Extra',[{material:'Extra'}]),draft);
 const pending={...draft,request:{p_request_id:'same'}};
 assert.equal(removeReplenishmentRow(pending,'Extra'),pending);
 assert.equal(canRemoveReplenishmentRow(JSON.parse(JSON.stringify(draft)),'Extra'),true);
});
test('zero or invalid quantities uncheck delivery and cannot be checked again',()=>{
 for(const quantity of ['0','','-1','1.5','1e2','2147483648']){
  assert.equal(validReplenishmentQuantity(quantity),false);
  const row=editReplenishmentRow({quantity:'2',checked:true},{quantity});
  assert.equal(row.checked,false);
  assert.equal(editReplenishmentRow(row,{checked:true}).checked,false);
 }
 assert.equal(editReplenishmentRow({quantity:'0',checked:false},{quantity:'3'}).checked,false);
 assert.equal(editReplenishmentRow({quantity:'3',checked:false},{checked:true}).checked,true);
});
test('confirmation feedback stays by the button and refresh never holds the send lock',()=>{
 const source=fs.readFileSync(new URL('../src/ReplenishmentPanel.jsx',import.meta.url),'utf8');
 assert.match(source,/disabled=\{frozen\|\|invalid\|\|registered\}/);
 assert.match(source,/aria-invalid=\{invalid\}/);
 assert.match(source,/replenishment-footer-notice/);
 assert.match(source,/createPortal/);
 assert.match(source,/document\.body/);
 assert.match(source,/role="alertdialog"/);
 assert.match(source,/\(busy\|\|message\|\|refreshNotice\)&&<ReplenishmentNotice/);
 assert.match(source,/!busy&&<button className="primary" onClick=\{onDismiss\}>Entendido/);
 assert.match(source,/void freshStock\(\)\.then/);
 assert.match(source,/boundedReplenishment\(\(\)=>refreshRef.current\?\.\(\),null,8000\)/);
 assert.doesNotMatch(source,/Sí, registrar entrega|type="checkbox"/);
 assert.doesNotMatch(source,/await onRefresh/);
});
test('replenishment covers every configured lot and zone and never defaults to Olot',()=>{
 for(const config of WAREHOUSE_DEPLOYMENTS){
  const scope=getWarehouseScope(config.lot,config.zone);
  for(const id of scope.warehouseIds){
   const draft=replenishmentDraft(scope,id,[{material:'Gasas',replenish:4}],'id');
   assert.equal(draft.rows.Gasas.checked,false);
   draft.rows.Gasas={quantity:'2',checked:true};
   const r=replenishmentRequest(scope,draft,['Gasas']);
   assert.equal(r.p_destination_id,id);assert.equal(r.p_lot,config.lot);assert.equal(r.p_zone,config.zone);
   assert.equal(r.p_origin_id,id===scope.central.id?null:scope.central.id);
   assert.deepEqual(r.p_items,{Gasas:2});
  }
 }
});
test('only checked materials are included, with strict integer quantities',()=>{
 assert.deepEqual(replenishmentItems({A:{quantity:'3',checked:true},B:{quantity:'8',checked:false}},['A','B']),{A:3});
 for(const quantity of ['',0,-1,1.5,'NaN','1e2',2147483648])assert.throws(()=>replenishmentItems({A:{quantity,checked:true}},['A']));
 assert.throws(()=>replenishmentItems({A:{quantity:'1',checked:false}},['A']));
 assert.throws(()=>replenishmentItems({X:{quantity:'1',checked:true}},['A']));
});
test('draft keys isolate admin, lot, zone and warehouse; invalid origin fails closed',()=>{
 const scope=getWarehouseScope(WAREHOUSE_DEPLOYMENTS[0].lot,WAREHOUSE_DEPLOYMENTS[0].zone);
 const key=replenishmentKey(scope,'one',scope.central.id);
 assert.notEqual(key,replenishmentKey(scope,'two',scope.central.id));
 assert.notEqual(key,replenishmentKey({...scope,lot:'Other'},'one',scope.central.id));
 assert.notEqual(key,replenishmentKey({...scope,zone:'Other'},'one',scope.central.id));
 const draft=replenishmentDraft(scope,scope.warehouseIds[1],[],'id');
 draft.origin='outside';assert.throws(()=>replenishmentRequest(scope,draft,[]));
 assert.throws(()=>replenishmentDraft(scope,'outside',[],'id'));
});
test('source checks never debit central for external receipts',()=>{
 assert.deepEqual(replenishmentShortages({p_origin_id:null,p_items:{A:60}},{}),[]);
 assert.deepEqual(replenishmentShortages({p_origin_id:'central',p_items:{A:60}},{A:59}),[['A',60]]);
});
test('unknown response is bounded and retries reuse the exact request',async()=>{
 const request={p_request_id:'stable',p_items:{A:2}},sent=[];
 const send=r=>{sent.push(r);return new Promise(()=>{});};
 await assert.rejects(boundedReplenishment(send,request,5),/TIMEOUT/);
 await assert.rejects(boundedReplenishment(send,request,5),/TIMEOUT/);
 assert.equal(sent[0],sent[1]);
 assert.equal(await boundedReplenishment(async()=>123,request),123);
});
