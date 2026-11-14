import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {combinedTsuChecklists} from '../src/tsu-checklist-report.mjs';
import {checklistIncidentDetails} from '../src/checklist-report-format.mjs';

test('BP and SVB share ordered records, missing units and expandable incidents',()=>{
 const records=combinedTsuChecklists(
  [{unit:'G450',guard_started_at:'2026-11-14T07:00:00Z',submitted_at:'2026-11-14T08:00:00Z',answers:{}}],
  [{unit:'BP50',guard_started_at:'2026-11-14T07:00:00Z',submitted_at:'2026-11-14T09:00:00Z',items:[{section:'Puerta trasera derecha · Material',label:'Lona',status:'issue',note:'Falta'}]}],
  ['G450','BP50','BP51','G451'],'2026-11-14','2026-11-14');
 assert.deepEqual(records.map(r=>r.unit),['BP50','G450','BP51','G451']);
 assert.equal(records[0].answers['rear-right'].Material['Lona — Falta'],'issue');
 const details=checklistIncidentDetails(records);
 assert.equal(details.length,1);
 assert.equal(details[0].zone,'Puerta trasera derecha');
 assert.equal(details[0].material,'Lona — Falta');
});
test('historical BP submissions prevent duplicate pending rows; no pre-launch missing BP',()=>{
 const historic={unit:'BP50',guard_started_at:'2026-11-13T07:00:00Z',submitted_at:'2026-11-13T08:00:00Z',answers:{}};
 assert.deepEqual(combinedTsuChecklists([historic],[],['BP50','BP51'],'2026-11-13','2026-11-13'),[historic]);
});
test('Excel export appends only the existing shared SVB sheet, not a separate BP sheet',()=>{
 const source=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
 assert.match(source,/combinedTsuChecklists\(svbChecklists,bpChecklists,svbRoster/);
 assert.doesNotMatch(source,/book_append_sheet\([^\n]*Checklist BP Polivalente/);
});
