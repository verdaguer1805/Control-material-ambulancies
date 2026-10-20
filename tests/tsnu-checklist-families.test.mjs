import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tsnuChecklistType,tsnuChecklistLabel,tsnuChecklistItems,tsnuChecklistGroups,TSNU_CHECKLIST_CATALOGS} from '../src/tsnu-checklist-catalog.mjs';
import {completeDemo,checklistStatus,checklistItems,TSNU_CHECKLIST_ITEMS} from '../src/checklist-demo.mjs';
import {auditItems,refreshPendingAudit} from '../src/vehicle-audit.mjs';
const record=(unit,scope={})=>({unit,lot:'Otro lote',zone:'Otra zona',date:'2026-10-19',service:'TSNU',vehicleType:'TSNU',answers:{},...scope});
const answers=items=>Object.fromEntries(items.map(item=>[item,'ok']));

test('TSNU families are global by prefix, with KE before K and no device reassignment',()=>{
 for(const [unit,type,label] of [['T1733','T','Tango (T)'],['K1376','K','Kilo (K)'],['KE1388','KE','Kilo Eco (KE)'],[' ke9999 ','KE','Kilo Eco (KE)']]){
  assert.equal(tsnuChecklistType(unit),type);assert.equal(tsnuChecklistLabel(unit),label);
  for(const lot of ['Lot 5','Lot 1','Futuro lote'])assert.deepEqual(checklistItems(record(unit,{lot})),tsnuChecklistItems(unit));
 }
 assert.equal(tsnuChecklistType('G450'),'');assert.deepEqual(tsnuChecklistItems('G450'),TSNU_CHECKLIST_ITEMS);
});
test('independent T, K and KE catalogs only differ by the two excluded tools',()=>{
 assert.deepEqual(tsnuChecklistItems('T999'),TSNU_CHECKLIST_ITEMS);
 for(const unit of ['K999','KE999'])assert.deepEqual(tsnuChecklistItems(unit),TSNU_CHECKLIST_ITEMS.filter(item=>!['Cizallas','Pata de cabra'].includes(item)));
 assert.notEqual(TSNU_CHECKLIST_CATALOGS.K,TSNU_CHECKLIST_CATALOGS.KE);
 assert.notEqual(TSNU_CHECKLIST_CATALOGS.K[0][1],TSNU_CHECKLIST_CATALOGS.KE[0][1]);
 const copy=tsnuChecklistGroups('K999');copy[0][1].push('not real');assert.ok(!tsnuChecklistItems('K999').includes('not real'));
});
test('pending K/KE keep other responses, require no tools, and never submit invented tool answers',()=>{
 for(const unit of ['K1376','KE1388']){
  const old=record(unit,{answers:{...answers(TSNU_CHECKLIST_ITEMS),Cizallas:'issue','Pata de cabra':'issue',DEA:'issue'}});
  const before=structuredClone(old),next=completeDemo(old);
  assert.deepEqual(old,before);assert.equal(next.answers.DEA,'issue');
  assert.ok(!Object.hasOwn(next.answers,'Cizallas'));assert.ok(!Object.hasOwn(next.answers,'Pata de cabra'));
  assert.equal(checklistStatus(next),'Incidencia');
  assert.throws(()=>completeDemo(record(unit,{answers:{DEA:'ok'}})),/Revisa todos/);
 }
 const t=record('T1733',{answers:answers(tsnuChecklistItems('K1376'))});assert.throws(()=>completeDemo(t),/Revisa todos/);
});
test('confirmed historical K/KE retain incidents on tools and old no-baliza records',()=>{
 for(const unit of ['K1376','KE1388']){
  const old=record(unit,{completed:true,answers:{...answers(TSNU_CHECKLIST_ITEMS),Cizallas:'issue'}}),before=structuredClone(old);
  assert.equal(checklistStatus(old),'Incidencia');assert.deepEqual(old,before);
  const legacy={...old,answers:{...old.answers}};delete legacy.answers['Baliza V-16'];assert.equal(checklistStatus(legacy),'Incidencia');
  assert.equal(checklistStatus(completeDemo(record(unit,{answers:answers(tsnuChecklistItems(unit))}))),'Correcto');
 }
});
test('TSNU supervisor audits follow the same family and retain confirmed historical audits',()=>{
 const oldCatalog=auditItems('TSNU','T9000');
 for(const unit of ['K9000','KE9000']){
  const old={type:'TSNU',vehicle:unit,catalog:oldCatalog,answers:answers(oldCatalog.map(i=>i.id)),notes:{}};
  const next=refreshPendingAudit(old);assert.ok(!next.catalog.some(i=>['Cizallas','Pata de cabra'].includes(i.label)));
  for(const item of next.catalog)assert.equal(next.answers[item.id],'ok');
  const confirmed={...old,confirmedAt:'2026-10-18T10:00:00Z'};assert.equal(refreshPendingAudit(confirmed),confirmed);
 }
});
test('server migration is scoped, strict, compatible with old clients, and cannot change stock or history in bulk',()=>{
 const sql=fs.readFileSync(new URL('../sql/tsnu-checklist-families-v1.sql',import.meta.url),'utf8');
 assert.ok(sql.indexOf("like 'KE%'")<sql.indexOf("like 'K%'"));
 assert.match(sql,/v_family:=public.tsnu_checklist_family\(v_shift.unit\)/);
 assert.match(sql,/v_shift.user_id is distinct from auth.uid\(\)/);
 assert.match(sql,/coalesce\(p_answers->>x,''\) not in/);
 assert.match(sql,/for update/);assert.match(sql,/CHECKLIST_ALREADY_SUBMITTED/);
 assert.match(sql,/where id=p_shift_id returning/);
 assert.match(sql,/array_remove\(array_remove\(v_required,'Cizallas'\),'Pata de cabra'\)/);
 assert.doesNotMatch(sql,/(update|insert into|delete from) public\.(stock|incidents|tsnu_unit_assignments|device_authorizations)/i);
 const equipmentSql=fs.readFileSync(new URL('../sql/tsnu-checklist-equipment-v3.sql',import.meta.url),'utf8');
 for(const item of TSNU_CHECKLIST_ITEMS)assert.ok((sql+equipmentSql).includes(`'${item}'`));
});
