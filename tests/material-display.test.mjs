import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {materialDisplayName} from '../src/material-display.mjs';
import {MATERIALS} from '../src/data.js';
import {SVB_RIGHT_ZONE_SECTIONS} from '../src/svb-right-zone-data.mjs';

test('correct dressing size is shown everywhere while historical stock identity stays stable',()=>{
 const original='Apósito 7x2,5';
 assert.equal(materialDisplayName(original),'Apósito 7,2x5');
 assert.equal(materialDisplayName('Apósito 7 × 2,5 · 4 unidades'),'Apósito 7,2x5 · 4 unidades');
 assert.equal(materialDisplayName('Apósito 10x8'),'Apósito 10x8');
 assert.ok(MATERIALS.includes(original));assert.ok(!MATERIALS.includes('Apósito 7,2x5'));
 assert.ok(SVB_RIGHT_ZONE_SECTIONS.find(s=>s.id===10).items.includes('Apósito 7,2x5 · 4 unidades'));
 const main=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
 assert.ok(main.includes('materialDisplayName(MATERIAL_LABELS[material] || material)'));
 assert.ok(main.includes('Material: materialLabel(item.label)'));
});
