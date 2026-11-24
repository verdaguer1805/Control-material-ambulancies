import test from 'node:test';
import assert from 'node:assert/strict';
import {pinSvbTemplate,requestedSvbTemplate,svbRightSections,auditSvbTemplate} from '../public/checklists/svb-template.js';
import {SVB_RIGHT_ZONE_SECTIONS} from '../public/checklists/svb-right-zone-data.js';
import {auditItems,refreshPendingAudit,auditComplete,auditRequest,saveAudit,readAudits} from '../src/vehicle-audit.mjs';
import {checklistReferenceSections} from '../src/checklist-reference.mjs';
import {svbAnswerSnapshot} from '../public/checklists/svb-send-reminder.js';
const storage=()=>{const m=new Map();return {m,getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v)}};
const context={unit:'G450',lot:'Lot 5 · Girona - Alt Maresme',zone:'Olot',guardCode:'2026-11-24:08:00',svbVariant:'SVB'};
test('existing answers in ANY zone freeze the legacy template; next guard selects normal',()=>{
 for(const zone of ['left','front','right','cabin','door']){
  const s=storage(),key=`cma_svb_${zone}_${zone==='right'?'zone':'wall'}_mobile_test_v1:${context.unit}:${context.guardCode}:5439`;
  s.setItem(key,JSON.stringify({8:{old:'issue'}}));const before=s.getItem(key);
  assert.equal(pinSvbTemplate(s,context,'5439'),'SVB 4x4');
  assert.equal(pinSvbTemplate(s,context,'5439'),'SVB 4x4');assert.equal(s.getItem(key),before);
  assert.equal(pinSvbTemplate(s,{...context,guardCode:'2026-11-25:08:00'},'5439'),'SVB');
  assert.equal(s.getItem(key),before);
 }
});
test('fleet defaults are scoped, known vehicle prevails, other lots keep explicit choice',()=>{
 for(const unit of ['G451','G452','G453'])assert.equal(requestedSvbTemplate({...context,unit},'9999'),'SVB 4x4');
 for(const vehicle of ['5538','5440','5441','5527'])assert.equal(requestedSvbTemplate(context,vehicle),'SVB 4x4');
 for(const vehicle of ['5439','5517','5413'])assert.equal(requestedSvbTemplate({...context,unit:'G452'},vehicle),'SVB');
 for(const lot of ['Lot 1','Lot 2','Lot 99'])for(const zone of ['Girona','Blanes','Figueres','Other'])for(const type of ['SVB','SVB 4x4'])
 assert.equal(requestedSvbTemplate({...context,lot,zone,svbVariant:type},'5538'),type);
});
test('unit, audit and consultation have exactly the same right wall; 4x4 unchanged',()=>{
 assert.deepEqual(svbRightSections('SVB 4x4'),SVB_RIGHT_ZONE_SECTIONS);
 for(const type of ['SVB','SVB 4x4']){
  const expected=svbRightSections(type).flatMap(s=>s.items);
  assert.deepEqual(auditItems(type).filter(i=>i.id.startsWith('Zona derecha-')).map(i=>i.label),expected);
  assert.deepEqual(checklistReferenceSections(type).filter(s=>s.area==='Zona derecha').flatMap(s=>s.groups.flatMap(g=>g.items)),expected);
 }
 assert.ok(svbRightSections('SVB').find(s=>s.id===7));
});
test('new and legacy audit drafts resume verbatim including notes and send with same ID',()=>{
 for(const type of ['SVB','SVB 4x4']){
  const s=storage(),catalog=auditItems(type),draft={id:'stable-id',type,vehicle:'5439',catalog,answers:Object.fromEntries(catalog.map(i=>[i.id,'issue'])),notes:{[catalog[0].id]:'Keep me'}};
  saveAudit(s,draft);const resumed=refreshPendingAudit(readAudits(s)[0]);assert.deepEqual(resumed,draft);
  assert.equal(auditSvbTemplate(resumed),type);assert.ok(auditComplete(resumed));
  assert.deepEqual(auditRequest(resumed),auditRequest(draft));
 }
 const old={type:'SVB',catalog:auditItems('SVB 4x4'),answers:{x:'ok'},notes:{x:'legacy'}};
 assert.equal(refreshPendingAudit(old),old);assert.equal(auditSvbTemplate(old),'SVB 4x4');
});
test('legacy payload fingerprint is unchanged; normal payload identifies catalog',()=>{
 const s=storage();s.setItem(`cma_svb_submitted_v1:${context.unit}:${context.guardCode}:5439`,'yes');
 assert.deepEqual(svbAnswerSnapshot(s,context,'5439'),{left:{},front:{},right:{},cabin:{},door:{}});
 assert.deepEqual(svbAnswerSnapshot(storage(),context,'5439')._template,{type:'SVB',version:1});
});
test('invalid pin fails closed without changing saved answers or identity',()=>{
 const s=storage(),key=`cma_svb_template_v1:${context.lot}:${context.unit}:${context.guardCode}:5439`;
 s.setItem(key,'damaged');assert.throws(()=>pinSvbTemplate(s,context,'5439'));assert.equal(s.getItem(key),'damaged');
});
