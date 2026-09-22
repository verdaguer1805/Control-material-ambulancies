import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AUTH_IDENTITY_KEY, priorAuthorizedDevice, rememberAuthorizedIdentity,
  readAuthorizedIdentity, recordAuthDiagnostic, readAuthDiagnostic, resolveAuthDiagnostic, authDiagnosticLabel,
} from '../src/auth-session-diagnostic.mjs';

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
}

test('missing identity is diagnosed only for previously authorized devices', () => {
  const authorized = storage({
    cma_unit: 'T1742',
    cma_device_authorization_v1: JSON.stringify({authorized:true,unit:'T1742'}),
  });
  assert.equal(priorAuthorizedDevice(authorized), true);
  rememberAuthorizedIdentity(authorized, 'original-user');
  assert.deepEqual(JSON.parse(authorized.getItem(AUTH_IDENTITY_KEY)), {unit:'T1742',userId:'original-user'});
  const first = recordAuthDiagnostic(authorized, 'session_missing');
  assert.equal(first.unit, 'T1742');
  assert.equal(readAuthDiagnostic(authorized).reason, 'session_missing');
  assert.deepEqual(recordAuthDiagnostic(authorized, 'session_missing'), first);
  assert.match(authDiagnosticLabel(first.reason), /desaparecido/);
  resolveAuthDiagnostic(authorized);
  assert.ok(readAuthDiagnostic(authorized).resolvedAt);
  assert.equal(recordAuthDiagnostic(authorized, 'session_missing').resolvedAt, undefined);
  assert.equal(priorAuthorizedDevice(storage()), false);
  authorized.removeItem('cma_device_authorization_v1');
  assert.equal(priorAuthorizedDevice(authorized), true);
  authorized.setItem('cma_unit', 'T1743');
  assert.equal(priorAuthorizedDevice(authorized), false);
});

test('an identity or session problem cannot silently create a new anonymous user', () => {
  const sessionSource = readFileSync(new URL('../src/supabase.js', import.meta.url), 'utf8');
  assert.match(sessionSource, /priorAuthorizedDevice\(localStorage\)/);
  assert.match(sessionSource, /if \(!allowNewIdentity\)\s*\{/);
  assert.ok(sessionSource.indexOf('throw error;') < sessionSource.indexOf('supabase.auth.signInAnonymously()'));
  const appSource = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
  assert.match(appSource, /ensureAnonymousSession\(\{ allowNewIdentity: true \}\)/);
  assert.match(appSource, /error\?\.code === "LOCAL_AUTH_SESSION_MISSING"/);
});

test('existing authorized device waits for explicit activation before creating a new identity', async () => {
  const source = readFileSync(new URL('../src/supabase.js', import.meta.url), 'utf8');
  const body = source.slice(source.indexOf('export async function ensureAnonymousSession('))
    .replace('export async function ensureAnonymousSession', 'async function ensureAnonymousSession');
  const make = new Function('env', `with (env) { ${body}; return ensureAnonymousSession; }`);
  let signIns = 0;
  const knownStorage = storage({
    cma_unit: 'T1742',
    cma_device_authorization_v1: JSON.stringify({authorized:true,unit:'T1742'}),
  });
  const env = {
    localStorage: knownStorage, readAuthorizedIdentity,
    priorAuthorizedDevice, recordAuthDiagnostic,
    recoverPreviousIdentity: async () => null,
    supabase: {auth: {
      getSession: async () => ({data:{session:null},error:null}),
      signInAnonymously: async () => { signIns++; return {data:{session:{user:{id:'new-user'}}},error:null}; },
    }},
  };
  const ensure = make(env);
  await assert.rejects(ensure(), {code:'LOCAL_AUTH_SESSION_MISSING'});
  assert.equal(signIns, 0);
  assert.equal(readAuthDiagnostic(knownStorage).reason, 'session_missing');
  await ensure({allowNewIdentity:true});
  assert.equal(signIns, 1);

  env.recoverPreviousIdentity = async () => ({user:{id:'original-user'}});
  const restored = await ensure();
  assert.equal(restored.user.id, 'original-user');
  assert.equal(signIns, 1);

  rememberAuthorizedIdentity(knownStorage,'original-user');
  env.supabase.auth.getSession = async () => ({data:{session:{user:{id:'wrong-user'}}},error:null});
  assert.equal((await ensure()).user.id,'original-user');
  assert.equal(readAuthDiagnostic(knownStorage).reason,'identity_changed');
  assert.equal(signIns,1);

  env.localStorage = storage();
  env.supabase.auth.getSession = async () => ({data:{session:null},error:null});
  await ensure();
  assert.equal(signIns, 2);
});
