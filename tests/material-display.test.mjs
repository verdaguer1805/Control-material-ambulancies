import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {materialDisplayName} from '../src/material-display.mjs';
import {MATERIALS} from '../src/data.js';
import {SVB_RIGHT_ZONE_SECTIONS} from '../src/svb-right-zone-data.mjs';

test('lancets are displayed and searched as units without changing stored material keys',()=>{
 assert.equal(materialDisplayName('Lancetas (caja)'), 'Lancetas (unidades)');
 assert.equal(materialDisplayName('Lancetas (cajas)'), 'Lancetas (unidades)');
 assert.equal(materialDisplayName('Lancetas (unidades)'), 'Lancetas (unidades)');
 assert.equal(materialDisplayName('Lancetas · 20 unidades'), 'Lancetas · 20 unidades');
 assert.equal(materialDisplayName('Guantes M (caja)'), 'Guantes M (caja)');
 assert.ok(MATERIALS.includes('Lancetas (caja)'));
 assert.ok(!MATERIALS.includes('Lancetas (unidades)'));
 const tsnu=fs.readFileSync(new URL('../src/ChecklistDemo.jsx',import.meta.url),'utf8');
 assert.ok(tsnu.includes('<span>{materialDisplayName(item)}</span>'));
 assert.ok(tsnu.includes('materialDisplayName(item).toLowerCase().includes(materialSearch.toLowerCase())'));
 assert.ok(tsnu.includes('materials:selected'));
 assert.ok(tsnu.includes('material[item]'));
});

test('correct dressing size is shown everywhere while historical stock identity stays stable',()=>{
 const original='Apósito 7x2,5';
 assert.equal(materialDisplayName(original),'Apósito 7,2x5');
 assert.equal(materialDisplayName('Apósito 7 × 2,5 · 4 unidades'),'Apósito 7,2x5 · 4 unidades');
 assert.equal(materialDisplayName('Apósito 10x8'),'Apósito 10x8');
 assert.ok(MATERIALS.includes(original));assert.ok(!MATERIALS.includes('Apósito 7,2x5'));
 assert.ok(SVB_RIGHT_ZONE_SECTIONS.find(s=>s.id===10).items.includes('Apósito 7,2x5 · 4 unidades'));
 const main=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
 assert.ok(main.includes('materialDisplayName(MATERIAL_LABELS[material] || material)'));
 assert.ok(main.includes('vehicleAuditReport(XLSX,vehicleAudits,materialLabel,madridDateTime)'));
 const report=fs.readFileSync(new URL('../src/checklist-report-format.mjs',import.meta.url),'utf8');
 assert.ok(report.includes('label(item.label)'));
});
