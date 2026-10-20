import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tsnuChecklistGroups,tsnuChecklistItems,tsnuChecklistItemLabel,tsnuReportedItemLabel,TSNU_NEW_FRONT_ITEMS} from '../src/tsnu-checklist-catalog.mjs';
import {completeDemo,checklistStatus} from '../src/checklist-demo.mjs';
import {auditItems} from '../src/vehicle-audit.mjs';
test('equipment and quantities apply globally to all three TSNU families',()=>{
 for(const unit of ['T9999','K9999','KE9999']){
  const groups=tsnuChecklistGroups(unit),labels=groups.flatMap(([,items])=>items.map(tsnuChecklistItemLabel));
  for(const label of ['DEA + parches + rasurador','Mantas de un solo uso · 4 unidades','Sonda de aspiración · 2 unidades','Cuña de hombre · 2 unidades','Cuña de mujer · 2 unidades','Bata EPI o mono de protección · 2 unidades','Baliza V-16 + chaleco de tránsito · 1 unidad','Cargador de teléfono · 1 unidad','Carpeta con documentación','Linterna + cono · 1 unidad'])assert.ok(labels.includes(label),`${unit}: ${label}`);
  assert.deepEqual(groups.find(([title])=>title==='Cajón n.º 2')[1],['Bolsas de vómito','Sonda de aspiración','Empapadores','Aspirador manual','Contenedor de agujas grande']);
  assert.deepEqual(auditItems('TSNU',unit).map(item=>item.label),labels);
  assert.equal(labels.includes('Cizallas'),unit.startsWith('T'));
  assert.equal(labels.includes('Pata de cabra'),unit.startsWith('T'));
 }
});
test('new items are mandatory for pending checklists but confirmed old ones keep their result',()=>{
 for(const unit of ['T9999','K9999','KE9999']){
  const answers=Object.fromEntries(tsnuChecklistItems(unit).map(item=>[item,'ok']));
  const record={unit,lot:'Any lot',zone:'Any zone',service:'TSNU',date:'2026-10-20',answers};
  assert.equal(checklistStatus(completeDemo(record)),'Correcto');
  const old=structuredClone(record);for(const item of TSNU_NEW_FRONT_ITEMS)delete old.answers[item];
  assert.throws(()=>completeDemo(old),/Revisa todos/);
  assert.equal(checklistStatus({...old,completed:true}),'Correcto');
  old.answers.DEA='issue';assert.equal(checklistStatus({...old,completed:true}),'Incidencia');
  assert.equal(tsnuReportedItemLabel('DEA',old.answers),'DEA');
  assert.equal(tsnuReportedItemLabel('DEA',answers),'DEA + parches + rasurador');
 }
});
test('equipment migration validates complete new payloads and leaves stock and historic rows untouched',()=>{
 const sql=fs.readFileSync(new URL('../sql/tsnu-checklist-equipment-v3.sql',import.meta.url),'utf8');
 for(const item of tsnuChecklistItems('T9999'))assert.ok(sql.includes(`'${item}'`));
 assert.match(sql,/v_current:=p_answers \?\| v_new/);
 assert.match(sql,/v_required:=v_required \|\| v_new/);
 assert.match(sql,/v_shift.user_id is distinct from auth.uid\(\)/);
 assert.match(sql,/CHECKLIST_ALREADY_SUBMITTED/);
 assert.match(sql,/where id=p_shift_id returning/);
 assert.doesNotMatch(sql,/(update|insert into|delete from) public\.(stock|incidents|tsnu_unit_assignments|device_authorizations)/i);
});
