import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');

test('warehouse transfer freezes and displays the selected destination', () => {
  assert.match(source, /setStockPickerTarget\(type === "transfer" \? stockDemoTarget : ""\)/);
  assert.match(source, /p_destination_id: STOCK_REMOTE_IDS\[stockPickerTarget\]/);
  assert.doesNotMatch(source, /p_destination_id: STOCK_REMOTE_IDS\[stockDemoTarget\]/);
  assert.match(source, /DESTINO CONFIRMADO/);
  assert.match(source, /Confirmar en \$\{stockPickerTarget\}/);
});
