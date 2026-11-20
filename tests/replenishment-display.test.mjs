import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('replenishment hides pending consumption globally without changing the calculation',()=>{
 const source=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
 const panel=fs.readFileSync(new URL('../src/ReplenishmentPanel.jsx',import.meta.url),'utf8');
 assert.match(panel, /Stock:.*Mínimo:/);
 assert.doesNotMatch(panel, /Pendiente:.*pending/);
 assert.ok(!source.includes('Pendiente: {item.pending}'));
 assert.ok(!source.includes('El material supervisor muestra el consumo pendiente.'));
 assert.ok(!source.includes('"Consumo pendiente": item.pending'));
 const excel=source.slice(source.indexOf('async function exportStockReplenishmentExcel()'),source.indexOf('async function exportStockReplenishmentExcel()')+5000);
 assert.match(excel,/e: \{ r: 0, c: 4 \}/);
 assert.match(excel,/\[\{ wch: 46 \}, \{ wch: 14 \}, \{ wch: 12 \}, \{ wch: 23 \}, \{ wch: 22 \}\]/);
 assert.match(source,/replenish: supplyType === "supervisor"\s*\? pending\s*: minimum > 0\s*\? Math\.max\(0, minimum - quantity\)/);
 assert.match(source,/groups=\{stockReplenishmentGroups\}/);
});
