import test from 'node:test';
import assert from 'node:assert/strict';
import {BP_ZONES,BP_ITEMS,bpPointItems,bpDraftPointItems,bpLegacyItems,bpStatus} from '../src/bp-operational.mjs';
import {auditComplete,auditRequest,saveAudit,readAudits} from '../src/vehicle-audit.mjs';
test('old BP bag with one marked item is green without requiring new contents',()=>{
 const front=BP_ZONES.find(z=>z.id==='front');
 assert.ok(bpPointItems(front,4).length>1);
 const catalog=[{id:'bp-item-276',label:'Mochila de intervención · 1 unidad',section:'Zona frontal · MOCHILA'}];
 const draft={id:'5132',vehicle:'5132',type:'Polivalente',catalog,answers:{'bp-item-276':'ok'},notes:{'bp-item-276':'Nota anterior'}};
 assert.deepEqual(bpDraftPointItems(draft,front,4),['bp-item-276']);
 assert.equal(bpStatus(draft.answers,bpDraftPointItems(draft,front,4)),'ok');
 assert.ok(auditComplete(draft));assert.equal(auditRequest(draft).p_items.length,1);
});
test('every historical item remains accessible, including ids removed from current map',()=>{
 const draft={vehicle:'5132',type:'Polivalente',catalog:[...BP_ITEMS,{id:'removed-old-id',label:'Material antiguo',section:'Sección antigua'}],answers:{},notes:{}};
 const covered=new Set([...BP_ZONES.flatMap(z=>bpDraftPointItems(draft,z)),...bpLegacyItems(draft).map(i=>i.id)]);
 assert.equal(covered.size,draft.catalog.length);
 draft.answers=Object.fromEntries(draft.catalog.map(i=>[i.id,'ok']));draft.answers['removed-old-id']='issue';draft.notes['removed-old-id']='Conservar observación';
 const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};saveAudit(storage,draft);
 const reopened=readAudits(storage)[0];assert.deepEqual(reopened,draft);assert.ok(auditComplete(reopened));assert.equal(auditRequest(reopened).p_items.at(-1).note,'Conservar observación');
});
