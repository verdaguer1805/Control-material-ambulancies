import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stockEntryQuantity } from '../src/stock-entry-quantity.mjs';

test('entrada directa: permite 60, cero, pegar números y vaciar antes de escribir', () => {
  for (const [text, expected] of [['60', 60], ['0', 0], ['4000', 4000], ['0060', 60], ['', '']]) {
    assert.equal(stockEntryQuantity(text), expected);
  }
});

test('entrada directa: no acepta negativos, decimales, exponentes ni cantidades inseguras', () => {
  for (const value of ['-1', '1.5', '1,5', '1e3', 'abc', 'Infinity', '9007199254740992']) {
    assert.equal(stockEntryQuantity(value), null);
  }
});

test('material recibido y reposición permiten edición directa sin cambiar consumos', () => {
  const source = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
  assert.match(source, /stockPickerOpen === "entry" \|\| stockPickerOpen === "transfer" \? \(\s*<input\s*className="stock-entry-quantity"/);
  assert.match(source, /Cantidad para reponer de/);
  assert.match(source, /inputMode="numeric"/);
  assert.match(source, /Number\(current\[material\] \|\| 0\) \+ amount/);
  assert.match(source, /supabase\.rpc\("receive_central_stock"/);
});

test('la reposición conserva destino, control de existencias y transferencia registrada', () => {
  const source = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
  const apply = source.slice(source.indexOf('async function applyStockPicker()'), source.indexOf('async function applyStockPicker()') + 6500);
  assert.match(apply, /STOCK_DEMO_LOCATIONS\.slice\(1\)\.includes\(stockPickerTarget\)/);
  assert.match(apply, /remaining: current - requested/);
  assert.match(apply, /if \(insufficientMaterials\.length\)/);
  assert.match(apply, /if \(belowMinimumMaterials\.length\)/);
  assert.match(apply, /supabase\.rpc\("transfer_stock_recorded"/);
  assert.match(apply, /p_origin_id: STOCK_REMOTE_IDS\[STOCK_DEMO_CENTRAL\]/);
  assert.match(apply, /p_destination_id: STOCK_REMOTE_IDS\[stockPickerTarget\]/);
});
