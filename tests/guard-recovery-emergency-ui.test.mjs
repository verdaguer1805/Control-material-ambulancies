import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');

test('a blocked current guard offers an explicit local-only discard path',()=>{
  assert.match(source,/hasCurrentPending && displayUnit\(currentUnit\)==='G451'.*setGuardRecoveryBlocked\(true\)/s);
  assert.match(source,/window\.confirm\(`ATENCIÓN: se eliminarán únicamente los consumos pendientes/);
  assert.match(source,/record\.unit===currentUnit && record\.id===guard\.code && !record\.synced/);
  assert.match(source,/Lo ya guardado en Supabase se conservará/);
  assert.match(source,/await prepareDeviceGuard\(currentUnit\)/);
});
