import test from 'node:test';
import assert from 'node:assert/strict';
import {auditStartError, validTsnuAuditVehicle, auditItems} from '../src/vehicle-audit.mjs';

test('TSNU audit creation requires a complete T, K or KE indicative in every zone',()=>{
  for(const value of ['T1733','K1376','KE1384',' k1376 ','ke1384']) {
    assert.equal(validTsnuAuditVehicle(value),true);
    assert.equal(auditStartError('TSNU',value),'');
  }
  for(const value of ['', '1733','5438','T','K','KE','G450','KT1733','T-1733','T17x','K 1376']) {
    assert.equal(validTsnuAuditVehicle(value),false);
    assert.match(auditStartError('TSNU',value),/T, K o KE/);
  }
  assert.equal(auditStartError('SVB','5438'),'');
  assert.equal(auditStartError('SVB','5517'),'');
  assert.ok(auditItems('TSNU','T1733').length > auditItems('TSNU','K1376').length);
  assert.deepEqual(auditItems('TSNU','K1376'),auditItems('TSNU','KE1384'));
});
