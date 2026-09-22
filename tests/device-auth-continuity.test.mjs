import test from 'node:test';
import assert from 'node:assert/strict';
import { cachedDeviceCanQueue } from '../src/device-auth-continuity.mjs';

const authorized={checked:true,enforcement:true,authorized:true,unit:'G450',lot:'Lot 5'};
test('a previously confirmed device may queue work while its session is restored',()=>{
  assert.equal(cachedDeviceCanQueue(authorized,'G450','Lot 5'),true);
  assert.equal(cachedDeviceCanQueue({...authorized,lot:undefined},'G450','Lot 5'),true); // older cache
});
test('unknown, revoked or differently assigned devices cannot use pending-verification mode',()=>{
  for(const cached of [null,{}, {...authorized,authorized:false}, {...authorized,checked:false},
    {...authorized,enforcement:false}, {...authorized,unit:'G451'}, {...authorized,lot:'Lot 7'}])
    assert.equal(cachedDeviceCanQueue(cached,'G450','Lot 5'),false);
});
