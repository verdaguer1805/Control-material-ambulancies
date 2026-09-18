import test from 'node:test';
import assert from 'node:assert/strict';
import { accessAttemptMessage } from '../src/access-attempt-message.mjs';
test('access rejection explains 3-minute and 1-hour waits, including remaining seconds',()=>{
  assert.match(accessAttemptMessage({retry_after_seconds:180}),/3 min/);
  assert.match(accessAttemptMessage({retry_after_seconds:3600}),/60 min/);
  assert.match(accessAttemptMessage({retry_after_seconds:61}),/1 min 1 s/);
  assert.match(accessAttemptMessage({retry_after_seconds:0,attempts_remaining:2}),/Quedan 2 intentos/);
  assert.equal(accessAttemptMessage(null),'Código incorrecto');
});
