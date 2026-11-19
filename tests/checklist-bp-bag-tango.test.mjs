import test from 'node:test';
import assert from 'node:assert/strict';
import {BP_ZONES,BP_ITEMS,bpPointItems,bpPayload} from '../src/bp-operational.mjs';
import {SVB_FRONT_WALL_SECTIONS} from '../src/svb-front-wall-data.mjs';
import {bpItemLabel} from '../src/bp-quantity.mjs';
import {tsnuChecklistItems,tsnuChecklistItemLabel} from '../src/tsnu-checklist-catalog.mjs';
import {auditItems,refreshPendingAudit} from '../src/vehicle-audit.mjs';
test('BP frontal point 4 contains the exact SVB bag subgroups, labels and quantities',()=>{
 const zone=BP_ZONES.find(z=>z.id==='front');
 const groups=zone.groups.filter(g=>g.point===4&&g.parentRow===274);
 const svb=SVB_FRONT_WALL_SECTIONS.find(s=>s.id===10).groups;
 assert.deepEqual(groups.map(g=>g.items.map(bpItemLabel)),svb.map(g=>g.items));
 assert.deepEqual(groups.map(g=>g.title),svb.map(g=>`Maleta de primera intervención · ${g.title}`));
 assert.equal(groups.length,9);
 assert.equal(new Set(BP_ITEMS.map(i=>i.id)).size,BP_ITEMS.length);
});
test('BP sliding door points move stable items, remove only the door 5L bottles',()=>{
 const z=BP_ZONES.find(z=>z.id==='sliding-left');
 assert.equal(z.title,'Puerta corredera izquierda');
 assert.deepEqual(bpPointItems(z,1).sort(),['bp-item-291','bp-item-292','bp-item-293','bp-item-309'].sort());
 assert.deepEqual(bpPointItems(z,2),['bp-item-297']);
 for(const id of ['bp-item-289','bp-item-290'])assert.ok(bpPointItems(z,3).includes(id));
 assert.ok(!bpPointItems(z,3).includes('bp-item-309'));
 assert.ok(BP_ITEMS.some(i=>i.id==='bp-item-188'));
});
test('only Tangos receive the front hammer, including audits in any lot',()=>{
 for(const family of ['T','K','KE','KB','VL']){
  assert.equal(tsnuChecklistItems(family+'999').includes('Martillo rompecristales'),family==='T');
  assert.deepEqual(auditItems('TSNU',family+'999').map(i=>i.label),tsnuChecklistItems(family+'999').map(tsnuChecklistItemLabel));
 }
});
test('moved BP items retain pending answers and notes, new bag items need review',()=>{
 const moved=BP_ITEMS.find(i=>i.id==='bp-item-289');
 const old={type:'Polivalente',vehicle:'5438',catalog:[{...moved,section:'Old section'}],answers:{[moved.id]:'issue'},notes:{[moved.id]:'Comprobar'}};
 const next=refreshPendingAudit(old);
 assert.equal(next.answers[moved.id],'issue');assert.equal(next.notes[moved.id],'Comprobar');
 assert.throws(()=>bpPayload(next),/Completa/);
 const sent={...old,confirmedAt:'2026-11-18'};assert.equal(refreshPendingAudit(sent),sent);
});
