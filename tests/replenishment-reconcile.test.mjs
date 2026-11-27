import test from 'node:test';
import assert from 'node:assert/strict';
import {replenishmentGroups,replenishmentDraft,reconcileReplenishment,replenishmentRowRequest,
 completeReplenishment,reopenReplenishment,validateReplenishmentDraft} from '../src/replenishment.mjs';
import {WAREHOUSE_DEPLOYMENTS,getWarehouseScope} from '../src/warehouse-config.mjs';
const material='Tubo de silicona LSU';

test('old unchecked AND checked drafts are recalculated after inventory adjustment everywhere',()=>{
 for(const config of [...WAREHOUSE_DEPLOYMENTS,{...WAREHOUSE_DEPLOYMENTS[0],lot:'Lot futur',zone:'Zona nova'}]){
  const scope=getWarehouseScope(config.lot,config.zone,[config]);
  for(const id of scope.warehouseIds)for(const checked of [false,true]){
   const draft=replenishmentDraft(scope,id,[{material,replenish:2}],'operation');
   draft.version=1;
   draft.rows[material].checked=checked;
   const fixed=reconcileReplenishment(draft,[],{[material]:4},{[material]:4});
   assert.deepEqual(fixed.rows,{});assert.equal(fixed.id,draft.id);
   assert.equal(fixed.version,2);
   assert.equal(draft.rows[material].quantity,'2');
  }
 }
});
test('changed stock/minimum rebases automatic quantities but same inventory preserves edits',()=>{
 let draft={id:'id',rows:{[material]:{quantity:'100',checked:true}},request:null};
 const proposals=[{material,replenish:2}];
 draft=reconcileReplenishment(draft,proposals,{[material]:2},{[material]:4});
 assert.equal(draft.rows[material].quantity,'2');
 draft.rows[material].quantity='1';
 assert.equal(reconcileReplenishment(draft,proposals,{[material]:2},{[material]:4}),draft);
 assert.equal(reconcileReplenishment(draft,[{material,replenish:3}],{[material]:1},{[material]:4}).rows[material].quantity,'3');
 assert.equal(reconcileReplenishment(draft,[{material,replenish:4}],{[material]:2},{[material]:6}).rows[material].quantity,'4');
});
test('explicit extra quantities survive resolved demand, zero and inventory changes',()=>{
 for(const quantity of ['0','7']){
  const next=reconcileReplenishment({rows:{Extra:{quantity,manual:true}},request:null},[],{Extra:10},{Extra:4});
  assert.equal(next.rows.Extra.quantity,quantity);assert.equal(next.rows.Extra.manual,true);
 }
});
test('unknown legacy multi-material requests are NEVER rebased or split',()=>{
 const draft={id:'old',rows:{A:{quantity:'2',checked:true},B:{quantity:'3',checked:true},C:{quantity:'8',checked:false}},request:{p_request_id:'old',p_items:{A:2,B:3}}};
 assert.equal(reconcileReplenishment(draft,[],{A:20},{A:2}),draft);
 assert.equal(reopenReplenishment(draft),draft);
 const done=completeReplenishment(draft,{request_id:'old'},'new');
 assert.equal(done.rows.A.registered.requestId,'old');assert.equal(done.rows.B.quantity,'3');
 assert.equal(done.rows.C.quantity,'8');assert.equal(done.request,null);
 assert.deepEqual(Object.keys(reopenReplenishment(done).rows),['C']);
 assert.throws(()=>completeReplenishment(draft,{request_id:'wrong'},'new'),/UNCONFIRMED/);
});
test('single-row delivery includes only clicked material, even with old checked rows',()=>{
 const scope=getWarehouseScope(WAREHOUSE_DEPLOYMENTS[0].lot,WAREHOUSE_DEPLOYMENTS[0].zone);
 const draft=replenishmentDraft(scope,scope.warehouseIds[1],[{material:'A',replenish:2},{material:'B',replenish:3}],'id');
 draft.rows.B.checked=true;
 const request=replenishmentRowRequest(scope,draft,'A',['A','B']);assert.deepEqual(request.p_items,{A:2});
 const done=completeReplenishment({...draft,request},{request_id:'id'},'new');
 assert.throws(()=>replenishmentRowRequest(scope,done,'A',['A','B']),/ALREADY_REGISTERED/);
 assert.equal(replenishmentRowRequest(scope,done,'B',['A','B']).p_request_id,'new');
});
test('configured minima use actual stock for supervisor supplies too; no-minimum queue remains',()=>{
 for(const type of ['standard','supervisor']){
  const groups=replenishmentGroups(['central','sub'],['A'],{central:{A:4},sub:{A:4}},
   {central:{A:4},sub:{A:4}},{central:{A:20},sub:{A:20}},{A:type});
  assert.deepEqual(groups.map(g=>g.items),[[],[]]);
 }
 const groups=replenishmentGroups(['central','sub'],['A'],{}, {},{sub:{A:2}},{A:'supervisor'});
 assert.equal(groups[0].items.length,0);assert.equal(groups[1].items[0].replenish,2);
});

test('recovered request must belong to the same lot, zone, origin, destination and operation',()=>{
 const scope=getWarehouseScope(WAREHOUSE_DEPLOYMENTS[0].lot,WAREHOUSE_DEPLOYMENTS[0].zone);
 const destination=scope.warehouseIds[1];
 const draft=replenishmentDraft(scope,destination,[{material:'A',replenish:2}],'id');
 draft.request=replenishmentRowRequest(scope,draft,'A',['A']);
 assert.equal(validateReplenishmentDraft(scope,draft,destination),draft);
 for(const key of ['p_request_id','p_lot','p_zone','p_origin_id','p_destination_id']){
  assert.throws(()=>validateReplenishmentDraft(scope,{...draft,request:{...draft.request,[key]:'different'}},destination),/Borrador no válido/);
 }
 for(const items of [{},{A:0},{A:-1},{A:1.5},{A:'2'}])assert.throws(()=>validateReplenishmentDraft(scope,{...draft,request:{...draft.request,p_items:items}},destination));
});
