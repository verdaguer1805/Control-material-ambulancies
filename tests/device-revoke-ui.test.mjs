import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/overrides.css',import.meta.url),'utf8');

test('revoke control stays beside its exact unit and requires typing that unit',()=>{
 assert.match(source,/className="device-unit-action"/);
 assert.match(source,/Escribe \$\{expectedUnit\} para confirmar/);
 assert.match(source,/confirmation\.trim\(\)\.toUpperCase\(\)!==expectedUnit\.toUpperCase\(\)/);
 assert.doesNotMatch(source,/<th scope="col">Acción<\/th>/);
 assert.match(css,/\.device-unit-action\{display:flex/);
});
