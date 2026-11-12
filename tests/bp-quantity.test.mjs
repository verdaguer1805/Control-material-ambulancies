import test from 'node:test';
import assert from 'node:assert/strict';
import {bpQuantityLabel} from '../src/bp-quantity.mjs';
test('BP quantities use singular/plural without changing existing units or missing quantities',()=>{
 assert.equal(bpQuantityLabel('1'),'1 unidad');
 assert.equal(bpQuantityLabel('2'),'2 unidades');
 assert.equal(bpQuantityLabel('5'),'5 unidades');
 assert.equal(bpQuantityLabel('1 rollo'),'1 rollo');
 assert.equal(bpQuantityLabel('1 paquete'),'1 paquete');
 assert.equal(bpQuantityLabel(null),'Cantidad pendiente de definir');
});
