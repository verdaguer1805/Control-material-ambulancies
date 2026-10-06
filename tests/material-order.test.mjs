import assert from 'node:assert/strict';
import test from 'node:test';
import { compareMaterialLabels } from '../src/material-order.mjs';

test('mixed glove families preserve size order regardless of input order', () => {
  const expected = ['Gafas nasales adultas', 'Guantes S (caja)', 'Guantes M (caja)', 'Guantes L (caja)', 'Guantes XL (caja)', 'Guantes estériles S', 'Guantes estériles M', 'Guantes estériles L', 'Kit de partos'];
  for (let offset = 0; offset < expected.length; offset++) {
    const input = [...expected.slice(offset), ...expected.slice(0, offset)].reverse();
    assert.deepEqual(input.sort(compareMaterialLabels), expected);
    assert.deepEqual(input.filter(x => x.includes('Guantes')).sort(compareMaterialLabels), expected.slice(1, 8));
  }
});

test('glove comparator is transitive across both families and adjacent materials', () => {
  const items = ['Guantes S (caja)', 'Guantes XL (caja)', 'Guantes L (caja)', 'Guantes M (caja)', 'Guantes estériles S', 'Guantes estériles L', 'Guantes estériles M', 'Gafas nasales adultas', 'Kit de partos'];
  for (const a of items) for (const b of items) for (const c of items) {
    if (compareMaterialLabels(a, b) <= 0 && compareMaterialLabels(b, c) <= 0) assert(compareMaterialLabels(a, c) <= 0);
  }
});
