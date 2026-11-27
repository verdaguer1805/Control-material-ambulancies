import test from 'node:test';
import assert from 'node:assert/strict';
import {SVB_NORMAL_RIGHT_V1,svbRightSections,pinSvbTemplate,pinSvbRightVersion,unitSvbRightSections} from '../public/checklists/svb-template.js';
import {SVB_RIGHT_ZONE_SECTIONS} from '../public/checklists/svb-right-zone-data.js';
import {svbAnswerSnapshot,svbReviewComplete} from '../public/checklists/svb-send-reminder.js';
import {SVB_LEFT_WALL_SECTIONS} from '../public/checklists/svb-left-wall-data.js';
import {SVB_FRONT_WALL_SECTIONS} from '../public/checklists/svb-front-wall-data.js';
import {SVB_DOOR_SECTIONS} from '../public/checklists/svb-door-data.js';
import {SVB_CABIN_ITEMS} from '../public/checklists/svb-cabin-data.js';
import {auditItems,refreshPendingAudit} from '../src/vehicle-audit.mjs';
import {checklistReferenceSections} from '../src/checklist-reference.mjs';
const memory=()=>{const m=new Map();return {m,getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)}};
const c={lot:'Lot 5 · Girona - Alt Maresme',zone:'Olot',unit:'G450',guardCode:'261126',svbVariant:'SVB'};
const mark=sections=>Object.fromEntries(sections.filter(s=>!s.pendingDefinition).map(s=>[s.id,Object.fromEntries((s.groups?s.groups.flatMap(g=>g.items):s.items).map(i=>[i,'ok']))]));
test('normal drawers change only specified quantities and add one heat bag',()=>{
 const s=svbRightSections('SVB');
 assert.deepEqual(s.find(s=>s.id===7).items,['Talla verde estéril · 2 unidades','Pinzas estériles · 2 unidades','Tijeras estériles · 2 unidades']);
 assert.deepEqual(s.find(s=>s.id===9).items,['Bolsa de hielo · 2 unidades','Bolsa de calor · 1 unidad','Inmovilizador de hombro · 1 unidad','Manta térmica · 4 unidades']);
 assert.deepEqual(s.find(s=>s.id===10).items,['Apósito 7,2x5 · 4 unidades','Apósito 10x8 · 4 unidades','Apósito 20x8 · 4 unidades','Sutura cutánea de papel 100x6 mm · 5 unidades']);
 for(const section of s)if(![7,9,10].includes(section.id))assert.deepEqual(section,SVB_NORMAL_RIGHT_V1.find(x=>x.id===section.id));
 assert.deepEqual(svbRightSections('SVB 4x4'),SVB_RIGHT_ZONE_SECTIONS);
});
test('started normal checklist keeps exact old answers and remains complete; next guard selects v2',()=>{
 const s=memory(),scope=`${c.unit}:${c.guardCode}:5439`;
 s.setItem(`cma_svb_template_v1:${c.lot}:${scope}`,'SVB');
 const answers={left:mark(SVB_LEFT_WALL_SECTIONS),front:mark(SVB_FRONT_WALL_SECTIONS),right:mark(SVB_NORMAL_RIGHT_V1),door:mark(SVB_DOOR_SECTIONS),cabin:{1:Object.fromEntries(SVB_CABIN_ITEMS.map(i=>[i,'ok']))}};
 for(const [z,a] of Object.entries(answers))s.setItem(`cma_svb_${z}_${z==='right'?'zone':'wall'}_mobile_test_v1:${scope}`,JSON.stringify(a));
 const before=JSON.stringify([...s.m]);
 assert.equal(pinSvbRightVersion(s,c,'5439'),1);
 const snapshot=svbAnswerSnapshot(s,c,'5439');assert.deepEqual(snapshot,{...answers,_template:{type:'SVB',version:1}});assert(svbReviewComplete(snapshot,false));
 assert.deepEqual(unitSvbRightSections(s,c,'5439'),SVB_NORMAL_RIGHT_V1);
 assert.equal(JSON.stringify([...s.m].filter(([k])=>!k.startsWith('cma_svb_right_version_v1:'))),before);
 assert.equal(pinSvbRightVersion(s,{...c,guardCode:'271126'},'5439'),2);
});
test('new checklist pins v2 before first answer and stays v2 on reopening in every lot/zone',()=>{
 for(const lot of ['Lot 1','Lot 5 · Girona - Alt Maresme','Lot 9'])for(const zone of ['Olot','Girona','Figueres','Blanes']){
  const s=memory(),context={...c,lot,zone};assert.equal(pinSvbTemplate(s,context,'5439'),'SVB');
  assert.equal(pinSvbRightVersion(s,context,'5439'),2);
  s.setItem(`cma_svb_left_wall_mobile_test_v1:${c.unit}:${c.guardCode}:5439`,JSON.stringify({1:{test:'ok'}}));
  assert.equal(pinSvbRightVersion(s,context,'5439'),2);
 }
});
test('new unit, auditor, consultation and exports share material; existing audit snapshot is untouched',()=>{
 const labels=svbRightSections('SVB').flatMap(s=>s.items);
 assert.deepEqual(auditItems('SVB').filter(i=>i.id.startsWith('Zona derecha-')).map(i=>i.label),labels);
 assert.deepEqual(checklistReferenceSections('SVB').filter(s=>s.area==='Zona derecha').flatMap(s=>s.groups.flatMap(g=>g.items)),labels);
 const draft={id:'old-audit',type:'SVB',catalog:[{id:'Zona derecha-7-0:1',label:'Pinzas estériles · 4 unidades',section:'Zona derecha · Compartimento 7'}],answers:{'Zona derecha-7-0:1':'ok'}};
 assert.deepEqual(refreshPendingAudit(draft),draft);
});
