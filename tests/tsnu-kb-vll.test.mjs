import test from 'node:test';
import assert from 'node:assert/strict';
import {tsnuChecklistType,tsnuChecklistItems,tsnuChecklistItemLabel,TSNU_CHECKLIST_CATALOGS} from '../src/tsnu-checklist-catalog.mjs';
import {auditItems,validTsnuAuditVehicle,auditStartError} from '../src/vehicle-audit.mjs';
import {CHECKLIST_REFERENCE_TYPES,checklistReferenceSections} from '../src/checklist-reference.mjs';
import {checklistItems,completeDemo} from '../src/checklist-demo.mjs';

test('KB matches KE and VL matches T globally, with independent catalogs',()=>{
 for(const [family,base] of [['KB','KE'],['VL','T']]){
  assert.equal(tsnuChecklistType(` ${family.toLowerCase()}1234 `),family);
  assert.deepEqual(TSNU_CHECKLIST_CATALOGS[family],TSNU_CHECKLIST_CATALOGS[base].map(([t,items])=>[t,items.filter(i=>i!=='Martillo rompecristales')]));
  assert.notEqual(TSNU_CHECKLIST_CATALOGS[family],TSNU_CHECKLIST_CATALOGS[base]);
  assert.notEqual(TSNU_CHECKLIST_CATALOGS[family][0][1],TSNU_CHECKLIST_CATALOGS[base][0][1]);
  for(const lot of ['Lot 5','Lot 7','Otro lote']){
   const record={unit:family+'1234',lot,zone:'Otra zona',service:'TSNU',vehicleType:'TSNU',answers:{}};
   const items=checklistItems(record);
   assert.deepEqual(items,tsnuChecklistItems(base+'1234').filter(i=>i!=='Martillo rompecristales'));
   record.answers=Object.fromEntries(items.map(i=>[i,'ok']));
   assert.doesNotThrow(()=>completeDemo(record));
  }
 }
});
test('unit, auditor and read-only reference use identical KB/VL content',()=>{
 for(const family of ['KB','VL']){
  const labels=tsnuChecklistItems(family+'1234').map(tsnuChecklistItemLabel);
  assert.ok(CHECKLIST_REFERENCE_TYPES.some(([type])=>type===family));
  assert.deepEqual(auditItems('TSNU',family+'1234').map(i=>i.label),labels);
  assert.deepEqual(checklistReferenceSections(family).flatMap(s=>s.groups.flatMap(g=>g.items)),labels);
  assert.equal(validTsnuAuditVehicle(family+'1234'),true);
  assert.equal(auditStartError('TSNU',family+'1234'),'');
  assert.equal(validTsnuAuditVehicle(family),false);
 }
 assert.equal(tsnuChecklistItems('KB1234').includes('Cizallas'),false);
 assert.equal(tsnuChecklistItems('VL1234').includes('Cizallas'),true);
});
