import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checklistFingerprint, checklistReminderKind } from '../public/checklists/checklist-send-reminder.js';
import { svbAnswerSnapshot, svbReviewComplete, rememberSvbSubmission, svbSentSnapshotKey } from '../public/checklists/svb-send-reminder.js';
import { SVB_LEFT_WALL_SECTIONS } from '../public/checklists/svb-left-wall-data.js';
import { SVB_FRONT_WALL_SECTIONS } from '../public/checklists/svb-front-wall-data.js';
import { SVB_RIGHT_ZONE_SECTIONS } from '../public/checklists/svb-right-zone-data.js';
import { SVB_DOOR_SECTIONS } from '../public/checklists/svb-door-data.js';
import { SVB_CABIN_ITEMS } from '../public/checklists/svb-cabin-data.js';
import { tsnuChecklistItems } from '../src/tsnu-checklist-catalog.mjs';
import { completeDemo } from '../src/checklist-demo.mjs';

const mark = sections => Object.fromEntries(sections.filter(s=>!s.pendingDefinition).map(s => [s.id,Object.fromEntries((s.groups ? s.groups.flatMap(g=>g.items) : s.items).map(item=>[item,'ok']))]));
function fullSvb() { return { left:mark(SVB_LEFT_WALL_SECTIONS),front:mark(SVB_FRONT_WALL_SECTIONS),right:mark(SVB_RIGHT_ZONE_SECTIONS),door:mark(SVB_DOOR_SECTIONS),cabin:{1:Object.fromEntries(SVB_CABIN_ITEMS.map(item=>[item,'ok']))} }; }
const storage = () => { const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value))}; };

test('aviso inicial solo con todos los elementos revisados, incluso con incidencias', () => {
  const answers=fullSvb(); assert.equal(svbReviewComplete(answers,false),true);
  answers.cabin[1][SVB_CABIN_ITEMS[0]]='issue'; assert.equal(svbReviewComplete(answers,false),true);
  assert.equal(checklistReminderKind({complete:true,confirmed:false}),'first');
  delete answers.cabin[1][SVB_CABIN_ITEMS[0]]; assert.equal(svbReviewComplete(answers,false),false);
  assert.equal(checklistReminderKind({complete:false,confirmed:false}),'');
});

test('reenviar solo si hay cambios y ha terminado la revisión', () => {
  const base={complete:true,confirmed:true,snapshot:'changed',sentSnapshot:'original'};
  assert.equal(checklistReminderKind(base),'');
  assert.equal(checklistReminderKind({...base,reviewingFinished:true}),'updated');
  assert.equal(checklistReminderKind({...base,reviewingFinished:true,snapshot:'original'}),'');
  assert.equal(checklistReminderKind({...base,reviewingFinished:true,complete:false}),'');
  assert.equal(checklistFingerprint({b:2,a:{d:4,c:3}}),checklistFingerprint({a:{c:3,d:4},b:2}));
});

test('huella enviada separada por unidad, guardia y vehículo; conserva el contenido confirmado', () => {
  const store=storage(),context={unit:'GTEST',guardCode:'311026'},answers=fullSvb();
  for(const [zone,value] of Object.entries(answers))store.setItem(`cma_svb_${zone}_${zone==='right'?'zone':'wall'}_mobile_test_v1:GTEST:311026:9999`,JSON.stringify(value));
  assert.deepEqual(svbAnswerSnapshot(store,context,'9999'),answers);
  rememberSvbSubmission(store,context,'9999',answers);
  const sent=store.getItem(svbSentSnapshotKey(context,'9999'));
  answers.cabin[1][SVB_CABIN_ITEMS[0]]='issue';
  assert.notEqual(sent,checklistFingerprint(answers));
  assert.equal(store.getItem(svbSentSnapshotKey({...context,guardCode:'011126'},'9999')),null);
  assert.equal(store.getItem(svbSentSnapshotKey(context,'9998')),null);
  assert.equal(store.getItem(svbSentSnapshotKey({...context,unit:'OTHER'},'9999')),null);
});

for(const unit of ['T9999','K9999','KE9999']) test(`completar ${unit}: verdes y rojos cuentan, gris no`, () => {
  const items=tsnuChecklistItems(unit),answers=Object.fromEntries(items.map(item=>[item,'ok']));answers[items[0]]='issue';
  assert.equal(completeDemo({service:'TSNU',unit,answers}).completed,true);
  delete answers[items.at(-1)];assert.throws(()=>completeDemo({service:'TSNU',unit,answers}),/Revisa todos/);
});

test('todas las fotografías conectan el recordatorio y se almacena la confirmación solo tras respuesta correcta', () => {
  for(const page of ['svb-preview.html','svb-front-preview.html','svb-right-preview.html','svb-door-preview.html']) {
    assert.match(readFileSync(new URL(`../public/${page}`,import.meta.url),'utf8'),/svb-send-reminder-page\.js/);
  }
  assert.match(readFileSync(new URL('../public/checklists/svb-cabin.js',import.meta.url),'utf8'),/installSvbSendReminder\(\)/);
  const source=readFileSync(new URL('../public/checklists/svb-zones-production.js',import.meta.url),'utf8');
  assert.ok(source.indexOf('if(!response.ok)throw')<source.indexOf('rememberSvbSubmission(localStorage'));
  assert.match(source,/if\(submitting\)return/);
  assert.match(source,/sendChecklist\(token,answers\)/);
  assert.match(source,/canPrompt:\(\)=>!submitting/);
  const tsnu=readFileSync(new URL('../src/ChecklistDemo.jsx',import.meta.url),'utf8');
  assert.match(tsnu,/showChecklistSendReminder\('first', finish\)/);
  assert.match(tsnu,/if\(finishLock.current\)return/);
  const worker=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
  for(const module of ['checklist-send-reminder.js','svb-send-reminder.js','svb-send-reminder-page.js'])assert.ok(worker.includes(module));
});
