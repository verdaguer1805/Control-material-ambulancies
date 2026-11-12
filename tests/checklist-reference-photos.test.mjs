import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SVB_PHOTO_LAYOUT} from '../src/svb-photo-layout.mjs';
import {checklistReferenceSections,CHECKLIST_REFERENCE_TYPES} from '../src/checklist-reference.mjs';
test('read-only photos reuse operational positions and every marker has real material',()=>{
 const sections=checklistReferenceSections('SVB');
 for(const layout of Object.values(SVB_PHOTO_LAYOUT)){
  assert.ok(fs.existsSync(new URL(`../public/checklists/${layout.image}`,import.meta.url)));
  for(const id of Object.keys(layout.positions)){
   const section=sections.find(row=>row.key===`${layout.title}:${id}`);
   assert.ok(section,`${layout.title}:${id}`);
   assert.ok(section.groups.some(group=>group.items.length));
  }
 }
 const source=fs.readFileSync(new URL('../src/ChecklistReferenceMap.jsx',import.meta.url),'utf8');
 assert.match(source,/SVB_PHOTO_LAYOUT/);
 assert.doesNotMatch(source,/localStorage|sessionStorage|supabase|\.rpc\(|markAll|saveAudit|auditRequest|<input|<select/);
 assert.ok(CHECKLIST_REFERENCE_TYPES.some(([key])=>key==='BP'));
 assert.ok(CHECKLIST_REFERENCE_TYPES.some(([key])=>key==='Polivalente'));
 assert.ok(CHECKLIST_REFERENCE_TYPES.some(([key])=>key==='Logística'));
});
