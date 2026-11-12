import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import XLSX from 'xlsx-js-style';
import {checklistReferenceWorkbook} from '../src/checklist-reference-export.mjs';
import {checklistReferenceSections} from '../src/checklist-reference.mjs';

test('each selected checklist exports all reference items without answers or omitted quantities',()=>{
 for(const type of ['SVB','T','K','KE','BP']){
  const book=checklistReferenceWorkbook(XLSX,type);
  assert.equal(book.SheetNames.length,1);
  const sheet=book.Sheets[book.SheetNames[0]];
  const expected=checklistReferenceSections(type).flatMap(section=>section.groups.flatMap(group=>group.items.map(item=>[section.area,section.title,group.title,item])));
  const buffer=XLSX.write(book,{type:'buffer',bookType:'xlsx'});
  const restored=XLSX.read(buffer,{type:'buffer'});
  const rows=XLSX.utils.sheet_to_json(restored.Sheets[restored.SheetNames[0]],{header:1});
  assert.deepEqual(rows.slice(1),expected);
  assert.ok(sheet['!autofilter']);
  assert.equal(sheet.A1.s.font.color.rgb,'FFFFFF');
 }
 for(const type of ['','Polivalente','Logística'])assert.throws(()=>checklistReferenceWorkbook(XLSX,type));
});
test('reference opens with no default checklist and download is restricted to defined content',()=>{
 const source=fs.readFileSync(new URL('../src/ChecklistReference.jsx',import.meta.url),'utf8');
 assert.match(source,/\[type, setType\] = useState\(''\)/);
 assert.match(source,/<option value="">Selecciona un checklist/);
 assert.match(source,/sections.length>0&&<button/);
 assert.match(source,/downloadChecklistReference\(type\)/);
});
