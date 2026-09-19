import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
const sql = readFileSync(new URL('../sql/admin-tsnu-reports-v1.sql', import.meta.url), 'utf8');

test('TSNU report read is protected and globally scoped by lot, zone and dates', () => {
  assert.match(sql, /admin_can_access_zone\(p_zone\)/);
  assert.match(sql, /s\.lot\s*=\s*p_lot\s+and\s+s\.zone\s*=\s*p_zone/i);
  assert.match(sql, /p_from date/);
  assert.match(sql, /p_to date/);
  assert.doesNotMatch(sql, /Lot 5|Olot|Figueres|Girona|Blanes/);
  assert.match(sql, /revoke all.+from public, anon/is);
});

test('the general Excel separates TSU, TSNU and both checklist types', () => {
  for (const sheet of ['Resumen general', 'Consumo TSU', 'Consumo TSNU', 'Material crítico', 'Checklist TSNU', 'Checklist TSU']) {
    assert.match(source, new RegExp(`book_append_sheet\\(wb, [^,]+, "${sheet}"\\)`));
  }
  assert.doesNotMatch(source, /Checklist · informes de prueba/);
});

test('the PDF receives TSNU data and renders consumption, critical material and checklist status', () => {
  assert.match(source, /exportPdf\(selected\.records, selected\.submissions, selected\.tsnu\)/);
  assert.match(source, /function exportPdf\(source = adminRecords, submissions = \[\], tsnuData = \{\}\)/);
  assert.match(source, /tsnuWithdrawals\.forEach/);
  assert.match(source, /unitMaterials\[unit\] = \(unitMaterials\[unit\] \|\| 0\) \+ quantity/);
  assert.match(source, /criticalUnits\[unit\]/);
  assert.match(source, /Control de checklist TSNU/);
  assert.match(source, /tsnuChecklistPages\(tsnuShifts\)/);
});

test('TSNU shows its DEA patches but excludes every Schiller patch from its material scroll', () => {
  assert.match(source, /"Parches dea tsnu": "Parches DEA TSNU"/);
  assert.match(source, /!\/\^Parches schiller \/i\.test\(material\)/);
  assert.match(source, /!\/\^Parches monitorización schiller\$\/i\.test\(material\)/);
  assert.match(source, /materialVisibility\[m\]!==false&&isTsnuMaterial\(m\)/);
});
