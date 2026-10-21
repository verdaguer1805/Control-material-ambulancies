import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SVB_LEFT_WALL_SECTIONS,leftRequiredSections,sectionStatus} from '../src/svb-left-wall-data.mjs';
test('confirmed old compartment 9 keeps its recorded quantity while unsent checks require three',()=>{
 const section=SVB_LEFT_WALL_SECTIONS.find(s=>s.id===9);
 const old={9:Object.fromEntries(section.items.map(item=>[item.replace('Tubo de silicona para aspirador (1 metro) · 3 unidades','Tubo de silicona para aspirador (1 metro) · 1 unidad'),'ok']))};
 const before=structuredClone(old);
 assert.equal(sectionStatus(leftRequiredSections([section],old,true)[0],old),'ok');
 assert.equal(sectionStatus(leftRequiredSections([section],old,false)[0],old),'pending');
 assert.deepEqual(old,before);
});
test('silicone tubes change only in left compartment 9, not aspirator 11',async()=>{
 const publicText=fs.readFileSync(new URL('../public/checklists/svb-left-wall-data.js',import.meta.url),'utf8');
 const publicModule=await import('data:text/javascript;base64,'+Buffer.from(publicText).toString('base64'));
 for(const sections of [SVB_LEFT_WALL_SECTIONS,publicModule.SVB_LEFT_WALL_SECTIONS]){
  assert.ok(sections.find(s=>s.id===9).items.includes('Tubo de silicona para aspirador (1 metro) · 3 unidades'));
  assert.ok(sections.find(s=>s.id===11).items.includes('Tubo de silicona para aspirador (1 metro) · 1 unidad'));
 }
});
test('SVB compact layout pins the send action above zones and retains touch targets and short-screen scrolling',()=>{
 const script=fs.readFileSync(new URL('../public/checklists/svb-zones-production.js',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../public/checklists/svb-zones-layout.css',import.meta.url),'utf8');
 const html=fs.readFileSync(new URL('../public/svb-zones.html',import.meta.url),'utf8');
 const worker=fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
 assert.match(script,/\['\.head','#vehicleCard','#submitChecklist','#submitStatus'\]/);
 assert.match(script,/\['#zonesPanel','#zonesLegend'\]/);
 assert.match(script,/Falta enviar/);
 assert.match(script,/button.disabled=!complete/);
 assert.match(css,/height:100dvh/);assert.match(css,/min-height:62px/);
 assert.match(css,/overflow-y:auto/);assert.match(css,/flex:0 0 auto/);
 assert.match(html,/svb-zones-layout.css\?v=/);assert.match(worker,/svb-zones-layout.css/);
});
