import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {AUDIT_STORAGE_KEY, auditGroups,auditItems,auditComplete,auditRequest,markAuditGroupCorrect,normalizeAuditVehicle,validAuditVehicle,isAuditSupervisor,saveAudit,readAudits,refreshPendingAudit} from '../src/vehicle-audit.mjs';
import {TSNU_CHECKLIST_ITEMS} from '../src/checklist-demo.mjs';
import {SVB_FRONT_WALL_SECTIONS,frontSectionItems} from '../src/svb-front-wall-data.mjs';
import {SVB_PHOTO_LAYOUT} from '../src/svb-photo-layout.mjs';

test('SVB audit photos and marker positions match the operational unit checklist',()=>{
 for(const [zone,file] of [['left','svb-preview.html'],['front','svb-front-preview.html'],['right','svb-right-preview.html'],['door','svb-door-preview.html']]){
  const html=fs.readFileSync(new URL(`../public/${file}`,import.meta.url),'utf8');
  const literal=html.match(/const pos=\{([^}]+)\}/)[1];
  const positions=Object.fromEntries([...literal.matchAll(/['"]?(\d+[a-z]?)['"]?:\[([\d.]+),([\d.]+)\]/g)].map(match=>[match[1],[+match[2],+match[3]]]));
  assert.deepEqual(SVB_PHOTO_LAYOUT[zone].positions,positions);
  assert.ok(html.includes(SVB_PHOTO_LAYOUT[zone].image));
 }
 const component=fs.readFileSync(new URL('../src/VehicleAudit.jsx',import.meta.url),'utf8');
 assert.match(component,/draft.type==='SVB'\?<VehicleAuditMap/);
 assert.ok(component.indexOf('if(preview)')<component.indexOf("await import('./supabase')"));
 assert.match(component,/preview \? sessionStorage : localStorage/);
});
test('audits use production catalogs including nested bags and cabin; pending types have no fake checklist',()=>{
 assert.deepEqual(auditItems('TSNU').map(x=>x.label),TSNU_CHECKLIST_ITEMS);
 const svb=auditItems('SVB');assert.equal(new Set(svb.map(x=>x.id)).size,svb.length);
 for(const section of SVB_FRONT_WALL_SECTIONS.filter(s=>!s.pendingDefinition))for(const item of frontSectionItems(section))assert.ok(svb.some(x=>x.label===item));
 assert.ok(auditGroups('SVB').some(x=>x.title==='Cabina de conducción'));
 assert.deepEqual(auditItems('Polivalente'),[]);assert.deepEqual(auditItems('Logística'),[]);
});
test('new compartments require review in pending audits without rewriting confirmed audits',()=>{
 const catalog=auditItems('SVB').filter(item=>!item.id.startsWith('Zona izquierda-11-'));
 const old={type:'SVB',vehicle:'5438',catalog,answers:Object.fromEntries(catalog.map(item=>[item.id,'ok'])),notes:{}};
 assert.ok(auditComplete(old));const updated=refreshPendingAudit(old);
 assert.equal(auditComplete(updated),false);assert.ok(updated.catalog.some(item=>item.label.startsWith('Tubo de silicona para aspirador')));
 assert.deepEqual(updated.answers,old.answers);const sent={...old,confirmedAt:'2026-10-08T07:00:00Z'};assert.equal(refreshPendingAudit(sent),sent);
});
test('vehicle identity needs no unit and accepts TSNU and numeric labels globally',()=>{
 for(const vehicle of ['T1733','5517','5438','KE1384'])assert.ok(validAuditVehicle(vehicle));
 assert.equal(normalizeAuditVehicle(' t1733 '),'T1733');assert.ok(!validAuditVehicle('<script>'));
 assert.ok(isAuditSupervisor('Material Supervisor · Otra zona'));assert.ok(!isAuditSupervisor('G450'));
});

test('replacing the aspirator placeholder does not transfer its answer to another item',()=>{
 const current=auditItems('SVB'),prefix='Zona izquierda-11-';
 const catalog=[...current.filter(item=>!item.id.startsWith(prefix)),{id:'Zona izquierda-11-0:0',section:'Zona izquierda · Aspirador',label:'Aspirador'}];
 const old={type:'SVB',catalog,answers:Object.fromEntries(catalog.map(item=>[item.id,'ok'])),notes:{}};
 const next=refreshPendingAudit(old);
 for(const item of next.catalog.filter(item=>item.id.startsWith(prefix)))assert.equal(next.answers[item.id],undefined);
 assert.equal(next.answers[current[0].id],'ok');
 assert.ok(SVB_FRONT_WALL_SECTIONS.find(s=>s.id===3).items.includes('Partes SEM · 1 bloc'));
 assert.equal(SVB_PHOTO_LAYOUT.front.positions[7][1]-SVB_PHOTO_LAYOUT.front.positions[6][1],4.5);
 assert.equal(SVB_PHOTO_LAYOUT.front.positions[8][1]-SVB_PHOTO_LAYOUT.front.positions[7][1],4.5);
});
test('new audits are grey, group marking preserves issues and immutable request has no guard or unit',()=>{
 let draft={id:'id',type:'TSNU',vehicle:'T1733',catalog:auditItems('TSNU'),answers:{},notes:{}};
 assert.equal(auditComplete(draft),false);
 const first=draft.catalog[0].id;draft.answers[first]='issue';
 for(const group of auditGroups('TSNU'))draft=markAuditGroupCorrect(draft,group.id);
 assert.equal(draft.answers[first],'issue');assert.ok(auditComplete(draft));
 const request=auditRequest(draft);assert.ok(!('p_unit' in request));assert.ok(!('p_guard_code' in request));assert.equal(request.p_items[0].status,'issue');
});
test('audit drafts preserve all operational storage and damaged drafts fail without overwriting',()=>{
 const map=new Map([['cma_unit_checklist_v1','original'],['cma_svb_checklist_context_v1','original']]);const storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
 saveAudit(storage,{id:'a',vehicle:'5438'});saveAudit(storage,{id:'b',vehicle:'T1733'});assert.equal(readAudits(storage).length,2);
 assert.equal(map.get('cma_unit_checklist_v1'),'original');assert.equal(map.get('cma_svb_checklist_context_v1'),'original');
 map.set(AUDIT_STORAGE_KEY,'broken');assert.throws(()=>saveAudit(storage,{id:'c'}));assert.equal(map.get(AUDIT_STORAGE_KEY),'broken');
});
test('server controls supervisor identity and scope, records exact receipt, and never touches operational data',()=>{
 const sql=fs.readFileSync(new URL('../sql/supervisor-vehicle-audits-v1.sql',import.meta.url),'utf8');
 assert.match(sql,/d\.user_id=auth\.uid\(\) and d\.active/);assert.match(sql,/SUPERVISOR_NOT_AUTHORIZED/);assert.match(sql,/w\.lot=v_device\.lot and w\.zone=v_zone/);assert.match(sql,/clock_timestamp\(\)/);assert.match(sql,/AUDIT_ALREADY_CONFIRMED/);assert.match(sql,/ADMIN_ZONE_ACCESS_DENIED/);
 assert.doesNotMatch(sql,/(insert into|update|delete from) public\.(incidents|svb_checklist_submissions|tsnu_shift_sessions|stock)/i);
 const main=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');assert.match(main,/isSupervisorMaterial\(currentUnit\) && \(/);assert.match(main,/<VehicleAudit/);
});
