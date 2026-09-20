import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');

test('a blocked current guard offers an explicit local-only discard path',()=>{
  assert.match(source,/hasUnitPending && displayUnit\(currentUnit\)==='G451'.*setGuardRecoveryBlocked\(true\)/s);
  assert.match(source,/window\.confirm\(`ATENCIÓN: se eliminarán \$\{matching\.length\} registro\(s\) pendiente\(s\) local\(es\) de/);
  assert.match(source,/record\.unit===currentUnit && !record\.synced/);
  assert.match(source,/Lo ya guardado en Supabase se conservará/);
  assert.match(source,/await prepareDeviceGuard\(currentUnit\)/);
  assert.match(source,/catch \(error\) \{\s+saveRecords\(list\);\s+setRecords\(\[\.\.\.list\]\);\s+const currentUnit=.*hasUnitPending=.*displayUnit\(currentUnit\)==='G451'.*setGuardRecoveryBlocked\(true\)/s);
});
