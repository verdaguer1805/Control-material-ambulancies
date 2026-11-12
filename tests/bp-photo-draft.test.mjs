import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BP_PHOTO_DRAFT,bpPhotoSections} from '../src/bp-photo-draft.mjs';
import {BP_CHECKLIST_SECTIONS} from '../src/bp-checklist-catalog.mjs';
test('BP draft photos preserve catalog and unique provisional assignments',()=>{
 const rows=[];
 for(const zone of BP_PHOTO_DRAFT){
  assert.ok(fs.existsSync(new URL(`../public/checklists/bp/${zone.id}.png`,import.meta.url)));
  assert.equal(new Set(zone.points.map(p=>p[0])).size,zone.points.length);
  for(const [,x,y,ids] of zone.points){assert.ok(x>0&&x<100&&y>0&&y<100);for(const id of ids){assert.ok(BP_CHECKLIST_SECTIONS.some(s=>s.sourceRow===id));rows.push(id);}}
 }
 assert.equal(rows.length,new Set(rows).size);
 assert.equal(rows.length,34); // Cabin remains available in complete reference list.
 assert.deepEqual(BP_PHOTO_DRAFT.find(z=>z.id==='under-vacuum').points[0][3],[51,65,69,77,87,94,102,113,126,136]);
 assert.deepEqual(BP_PHOTO_DRAFT.find(z=>z.id==='left').points.find(p=>p[0]===3)[3],[147]);
 const source=fs.readFileSync(new URL('../src/BpChecklistReferenceMap.jsx',import.meta.url),'utf8');
 assert.doesNotMatch(source,/supabase|localStorage|sessionStorage|saveAudit|auditRequest|<input/);
});
test('BP photo relocation preserves every item once and leaves only three items at left point 3',()=>{
 const left=BP_PHOTO_DRAFT.find(z=>z.id==='left');
 assert.deepEqual(bpPhotoSections(left,left.points.find(p=>p[0]===3))[0].items.map(i=>i.label),['Lona azul','Colchón de vacío','Bomba de vacío']);
 const items=BP_PHOTO_DRAFT.flatMap(z=>z.points.flatMap(p=>bpPhotoSections(z,p).flatMap(s=>s.items)));
 const expected=BP_CHECKLIST_SECTIONS.filter(s=>BP_PHOTO_DRAFT.some(z=>z.points.some(p=>p[3].includes(s.sourceRow)))).flatMap(s=>s.items);
 assert.deepEqual(items.map(i=>i.id).sort(),expected.map(i=>i.id).sort());
 assert.equal(new Set(items.map(i=>i.id)).size,items.length);
});
