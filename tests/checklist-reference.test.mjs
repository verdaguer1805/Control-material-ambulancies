import test from 'node:test';
import assert from 'node:assert/strict';
import { canReadChecklistReference, checklistReferenceSections, filterChecklistReference } from '../src/checklist-reference.mjs';
import { auditItems } from '../src/vehicle-audit.mjs';
import { SVB_LEFT_WALL_SECTIONS } from '../public/checklists/svb-left-wall-data.js';
import { SVB_FRONT_WALL_SECTIONS } from '../public/checklists/svb-front-wall-data.js';
import { SVB_RIGHT_ZONE_SECTIONS } from '../public/checklists/svb-right-zone-data.js';
import { SVB_DOOR_SECTIONS } from '../public/checklists/svb-door-data.js';
import { SVB_CABIN_ITEMS } from '../public/checklists/svb-cabin-data.js';
import { tsnuChecklistGroups, tsnuChecklistItemLabel } from '../src/tsnu-checklist-catalog.mjs';

test('template reference is restricted to operational admin roles', () => {
  for (const role of ['owner','supervisor','logistics']) assert.equal(canReadChecklistReference({role}), true);
  for (const role of ['reports_viewer','auditor','unit',undefined]) assert.equal(canReadChecklistReference({role}), false);
  assert.equal(canReadChecklistReference(null), false);
});
test('SVB reference keeps the complete catalog and compartment 8 search is precise', () => {
  const sections = checklistReferenceSections('SVB');
  assert.deepEqual(sections.flatMap(section => section.groups.flatMap(group => group.items)), auditItems('SVB').map(item => item.label));
  const normalize = label => label.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const unitAreas = [['Zona izquierda',SVB_LEFT_WALL_SECTIONS], ['Zona frontal',SVB_FRONT_WALL_SECTIONS],
    ['Zona derecha',SVB_RIGHT_ZONE_SECTIONS], ['Puerta corredera izquierda',SVB_DOOR_SECTIONS],
    ['Cabina de conducción',[{id:'cabina',items:SVB_CABIN_ITEMS}]]];
  assert.equal(sections.length, unitAreas.flatMap(([, rows]) => rows.filter(row => !row.pendingDefinition)).length);
  for (const [area, rows] of unitAreas) for (const section of rows.filter(row => !row.pendingDefinition)) {
    const reference = sections.find(row => row.key === `${area}:${section.id}`);
    const unitItems = section.groups ? section.groups.flatMap(group => group.items) : section.items;
    assert.deepEqual(reference.groups.flatMap(group => group.items).map(normalize), unitItems.map(normalize));
  }
  const hits = filterChecklistReference(sections, '', 'compartiment 8');
  assert.equal(hits.length, 3);
  assert.ok(hits.every(section => section.title === 'Compartimento 8'));
  assert.equal(filterChecklistReference(sections, 'Zona derecha', 'compartimento 8 pinzas').length, 1);
});
test('TSNU variants reflect their own catalogs and the BP draft is not enabled', () => {
  const items = type => checklistReferenceSections(type).flatMap(section => section.groups.flatMap(group => group.items));
  assert.ok(items('T').includes('Cizallas'));
  for (const type of ['K','KE']) assert.ok(!items(type).includes('Cizallas'));
  assert.deepEqual(items('BP'), []);
  assert.equal(filterChecklistReference(checklistReferenceSections('T'), '', 'cajón 2').length, 1);
  for (const [type,unit,count] of [['T','T1733',26], ['K','K1376',24], ['KE','KE1384',24]]) {
    const expected = tsnuChecklistGroups(unit).flatMap(([, rows]) => rows.map(tsnuChecklistItemLabel));
    assert.equal(expected.length,count);
    assert.deepEqual(items(type), expected);
    assert.deepEqual(auditItems('TSNU',unit).map(item => item.label), expected);
  }
});
