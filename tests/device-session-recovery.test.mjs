import test from 'node:test';
import assert from 'node:assert/strict';
import { recoveryMatches, rememberRecoverySession, recoverAuthorizedSession } from '../src/device-session-recovery.mjs';
import { AUTH_IDENTITY_KEY } from '../src/auth-session-diagnostic.mjs';

function storage(unit = 'G450', lot = 'Lot 5') {
  const values = new Map([
    ['cma_unit', unit], ['cma_lot', lot],
    [AUTH_IDENTITY_KEY, JSON.stringify({unit, userId:'same-device'})],
  ]);
  return {getItem:key=>values.get(key) ?? null};
}

function fakeIndexedDb() {
  const values = new Map();
  return {
    open() {
      const request = {result: {
        createObjectStore() {}, close() {},
        transaction() { return {
          objectStore() { return {
            get(key) { const result={}; queueMicrotask(()=>{result.result=values.get(key);result.onsuccess?.();}); return result; },
            put(value,key) { const result={}; queueMicrotask(()=>{values.set(key,value);result.onsuccess?.();}); return result; },
            delete(key) { const result={}; queueMicrotask(()=>{values.delete(key);result.onsuccess?.();}); return result; },
          }; },
        }; },
      }};
      queueMicrotask(()=>{request.onupgradeneeded?.();request.onsuccess?.();});
      return request;
    },
  };
}

test('a recovery credential is tied to the same identity, unit and lot', () => {
  const record={userId:'same-device',unit:'G450',lot:'Lot 5',accessToken:'a',refreshToken:'r'};
  const identity={userId:'same-device',unit:'G450'};
  assert.equal(recoveryMatches(record,identity,'G450','Lot 5'),true);
  assert.equal(recoveryMatches(record,identity,'G451','Lot 5'),false);
  assert.equal(recoveryMatches(record,identity,'G450','Lot 7'),false);
  assert.equal(recoveryMatches(record,{...identity,userId:'other'},'G450','Lot 5'),false);
});

test('a lost Supabase session can restore only the previously authorized identity', async () => {
  const previous=globalThis.indexedDB;
  globalThis.indexedDB=fakeIndexedDb();
  try {
    const original={user:{id:'same-device'},access_token:'access',refresh_token:'refresh'};
    assert.equal(await rememberRecoverySession(original,storage()),true);
    let attempts=0;
    const auth={setSession:async tokens=>{
      attempts++;
      assert.deepEqual(tokens,{access_token:'access',refresh_token:'refresh'});
      return {data:{session:original},error:null};
    }};
    assert.equal((await recoverAuthorizedSession(auth,storage()))?.user?.id,'same-device');
    assert.equal(attempts,1);
    assert.equal(await recoverAuthorizedSession(auth,storage('G451')),null);
    assert.equal(attempts,1);
    assert.equal(await recoverAuthorizedSession(auth,storage('G450','Lot 7')),null);
    assert.equal(attempts,1);
    assert.equal(await recoverAuthorizedSession({setSession:async()=>({data:{session:{user:{id:'other'}}},error:null})},storage()),null);
  } finally { globalThis.indexedDB=previous; }
});

test('no recovery secret is written before server authorization is remembered', async () => {
  const previous=globalThis.indexedDB;
  globalThis.indexedDB=fakeIndexedDb();
  try {
    const session={user:{id:'same-device'},access_token:'access',refresh_token:'refresh'};
    const unknown={getItem:key=>key==='cma_unit'?'G450':key==='cma_lot'?'Lot 5':null};
    assert.equal(await rememberRecoverySession(session,unknown),false);
    assert.equal(await recoverAuthorizedSession({setSession:async()=>{throw new Error('must not be called');}},unknown),null);
  } finally { globalThis.indexedDB=previous; }
});

test('unavailable browser storage cannot fabricate an authorization', async () => {
  const previous=globalThis.indexedDB;
  globalThis.indexedDB=undefined;
  try {
    await assert.rejects(rememberRecoverySession({user:{id:'same-device'},access_token:'a',refresh_token:'r'},storage()),/IndexedDB unavailable/);
    await assert.rejects(recoverAuthorizedSession({setSession:async()=>({})},storage()),/IndexedDB unavailable/);
  } finally { globalThis.indexedDB=previous; }
});
