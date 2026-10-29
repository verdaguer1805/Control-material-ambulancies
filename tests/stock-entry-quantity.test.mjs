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

test('solo material recibido usa edición directa; conserva la recepción remota existente', () => {
  const source = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
  assert.match(source, /stockPickerOpen === "entry" \? \(\s*<input\s*className="stock-entry-quantity"/);
  assert.match(source, /inputMode="numeric"/);
  assert.match(source, /Number\(current\[material\] \|\| 0\) \+ amount/);
  assert.match(source, /supabase\.rpc\("receive_central_stock"/);
});
