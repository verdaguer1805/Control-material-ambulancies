import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('public worker route exposes the isolated SVB preview and the TSNU production checklist without demo reports', () => {
  const source = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /canDemoChecklist/);
  assert.match(source, /<ChecklistDemo[\s\S]*?production[\s\S]*?\/>/);
  assert.doesNotMatch(source, /reportsOnly/);
  assert.doesNotMatch(source, /Checklist · informes de prueba/);
  assert.match(source, /currentChecklistConfig\.checklist === "SVB"/);
  assert.match(source, /svb-preview\.html\?from=pwa-v175/);
  assert.match(source, /: flash\("Próximamente"\)/);
  assert.match(source, /isTsnuMaterial\(m\)/);
});

test('v175 caches the isolated SVB preview for company mobiles', () => {
  const worker = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(worker, /const CACHE = "cma-v175"/);
  assert.match(worker, /\.\/svb-preview\.html/);
  assert.match(worker, /svb-paret-lateral-esquerre-real\.png/);
});
