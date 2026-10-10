import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SVB_DOOR_SECTIONS as sections,doorSectionStatus,doorRequired} from '../src/svb-door-data.mjs';
import {auditItems,refreshPendingAudit,auditComplete} from '../src/vehicle-audit.mjs';

test('door contains only four physical compartments and requested printed quantities',()=>{
 assert.deepEqual(sections.map(s=>s.id),[1,2,3,4]);
 assert.equal(sections[0].items.length,9);
 assert.deepEqual(sections[2].items,['Colchón de vacío · 1 unidad']);
 assert.deepEqual(sections[3].items,['Silla de evacuación · 1 unidad','Botella de oxígeno 10 L · 2 unidades']);
 assert.ok(!JSON.stringify(sections).match(/Bomba|férula|funda/i));
 assert.equal(fs.readFileSync(new URL('../src/svb-door-data.mjs',import.meta.url),'utf8'),fs.readFileSync(new URL('../public/checklists/svb-door-data.js',import.meta.url),'utf8'));
});
test('new door is grey until reviewed and incidents remain red',()=>{
 for(const section of sections){
  assert.equal(doorSectionStatus(section,{}),'pending');
  const answers={[section.id]:Object.fromEntries(section.items.map(i=>[i,'ok']))};
  assert.equal(doorSectionStatus(section,answers),'ok');
  answers[section.id][section.items[0]]='issue';
  assert.equal(doorSectionStatus(section,answers),'issue');
 }
 assert.ok(doorRequired({},false));assert.equal(doorRequired({},true),false);
 assert.ok(doorRequired({1:{}},true));
});
test('door joins audits globally without altering confirmed audits or existing answers',()=>{
 const catalog=auditItems('SVB').filter(i=>!i.section.startsWith('Puerta corredera izquierda'));
 const old={type:'SVB',vehicle:'5439',catalog,answers:Object.fromEntries(catalog.map(i=>[i.id,'ok'])),notes:{}};
 assert.ok(auditComplete(old));const next=refreshPendingAudit(old);
 assert.equal(auditComplete(next),false);assert.deepEqual(next.answers,old.answers);
 assert.equal(next.catalog.length-catalog.length,15);
 const sent={...old,confirmedAt:'2026-10-10T07:00:00Z'};assert.equal(refreshPendingAudit(sent),sent);
});
test('door is submitted, reported, cached, and local preview cannot write operational drafts',()=>{
 const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
 assert.match(read('public/checklists/svb-zones-production.js'),/door:zoneAnswers\("door"\)/);
 assert.match(read('public/svb-zones.html'),/id="door"/);
 assert.match(read('src/main.jsx'),/"Puerta corredera izquierda": zoneState\("door"\)/);
 assert.match(read('public/sw.js'),/svb-puerta-izquierda-mobile.jpg/);
 assert.match(read('public/svb-door-preview.html'),/storage=preview\?sessionStorage:localStorage/);
});
