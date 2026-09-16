import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGED_WAREHOUSE_DEPLOYMENTS as configs, planOpeningInventory } from '../src/warehouse-expansion.mjs';
import { DEFAULT_STOCK_LOT, getWarehouseScope } from '../src/warehouse-config.mjs';

test('validated zones have 63 ambulances, 28 subwarehouses and three supervisor assignments', () => {
  assert.deepEqual(configs.map(c => c.warehouses.reduce((n, w) => n + w.unitCount, 0)), [18, 23, 22]);
  assert.deepEqual(configs.map(c => c.warehouses.length - 1), [9, 10, 9]);
  const assignments = configs.flatMap(c => Object.keys(c.unitAssignments));
  assert.equal(assignments.length, 66);
  assert.equal(new Set(assignments).size, 66);
  for (const c of configs) {
    assert.equal(c.unitAssignments[`Material Supervisor · ${c.zone}`], c.warehouses[0].id);
    assert.equal(getWarehouseScope(DEFAULT_STOCK_LOT, c.zone).central.id, c.warehouses[0].id);
    assert.equal(c.enabled, false);
    assert.equal(c.initializeRpc, null);
    assert(!c.warehouses.some(w => w.id.includes('olot')));
  }
});

test('minimums count each ambulance once and round central safety upward', () => {
  for (const c of configs) {
    const rows = planOpeningInventory(c, { Test: 3 }, ['Test']);
    assert(rows.every(r => r.quantity === 1000));
    assert.equal(rows[0].minimum_quantity, Math.ceil(3 * c.warehouses.reduce((n,w) => n+w.unitCount,0) * 1.3));
    for (let i=1; i<rows.length; i++) assert.equal(rows[i].minimum_quantity, 3*c.warehouses[i].unitCount);
    rows[0].quantity = 17;
    rows[1].minimum_quantity = 99;
    assert.deepEqual(planOpeningInventory(c, { Test: 3 }, ['Test'], rows), []);
    assert.equal(rows[0].quantity, 17);
    assert.equal(rows[1].minimum_quantity, 99);
  }
});

test('missing base minimum fails instead of silently configuring zero', () => {
  assert.throws(() => planOpeningInventory(configs[0], {}, ['Unknown']), /Camprodon/);
});
