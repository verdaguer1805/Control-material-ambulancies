import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');

test('a blocked current guard offers an explicit local-only discard path',()=>{
  assert.match(source,/hasUnitPending && isRecoverableGuardSyncError\(error\).*setGuardRecoveryBlocked\(true\)/s);
  assert.match(source,/const authorized=await verifyAdminPin\(pin\)/);
  assert.match(source,/isolateGuardPending\(original,scope\)/);
  assert.match(source,/recoverGuardPendingTransaction\(/);
  assert.match(source,/Lo guardado en Supabase y los pendientes de otras guardias no se modificarán/);
  assert.match(source,/await prepareDeviceGuard\(currentUnit\)/);
  assert.doesNotMatch(source,/displayUnit\(currentUnit\)==='G451'.*setGuardRecoveryBlocked\(true\)/s);
});
