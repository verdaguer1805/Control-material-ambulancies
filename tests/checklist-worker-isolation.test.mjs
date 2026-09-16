import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('public worker route exposes placeholder only, never checklist simulation controls', () => {
  const source = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /canDemoChecklist/);
  const components = source.match(/<ChecklistDemo\b[^>]*\/>/g) || [];
  assert.equal(components.length, 1);
  assert.match(components[0], /reportsOnly/);
  assert.match(source, /onClick=\{\(\) => flash\("Próximamente"\)\}/);
});
