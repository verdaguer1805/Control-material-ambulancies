import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('public worker route exposes the isolated SVB preview and the TSNU production checklist without demo reports', () => {
  const source = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /canDemoChecklist/);
  assert.match(source, /<ChecklistDemo[\s\S]*?production[\s\S]*?\/>/);
  assert.doesNotMatch(source, /reportsOnly/);
  assert.doesNotMatch(source, /Checklist · informes de prueba/);
  assert.match(source, /currentChecklistConfig\.checklist !== "SVB"/);
  assert.match(source, /svb-zones\.html\?from=pwa-v179/);
  assert.match(source, /cma_svb_checklist_context_v1/);
  assert.match(source, /return flash\("Próximamente"\)/);
  assert.match(source, /isTsnuMaterial\(m\)/);
});

test('v179 caches the isolated SVB zone menu and previews for company mobiles', () => {
  const worker = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(worker, /const CACHE = "cma-v179"/);
  assert.match(worker, /\.\/svb-zones\.html/);
  assert.match(worker, /\.\/svb-preview\.html/);
  assert.match(worker, /\.\/svb-front-preview\.html/);
  assert.match(worker, /svb-paret-lateral-esquerre-mobile\.jpg/);
  assert.match(worker, /svb-paret-frontal-mobile\.jpg/);
});

test('SVB zones require a four-digit vehicle label and scope drafts by unit, guard and vehicle', () => {
  const menu = fs.readFileSync(new URL('../public/svb-zones.html', import.meta.url), 'utf8');
  const left = fs.readFileSync(new URL('../public/svb-preview.html', import.meta.url), 'utf8');
  const front = fs.readFileSync(new URL('../public/svb-front-preview.html', import.meta.url), 'utf8');
  assert.match(menu, /Rotulación del vehículo TSU/);
  assert.match(menu, /\^\\d\{4\}\$/);
  assert.match(menu, /cma_svb_vehicle_label_v1/);
  assert.match(menu, /Vehículo \$\{vehicle\} seleccionado/);
  assert.match(menu, /card\.classList\.toggle\("confirmed",valid\)/);
  assert.match(menu, /Número modificado: pulsa Confirmar/);
  assert.match(left, /cma_svb_left_wall_mobile_test_v1:\$\{scope\}:\$\{vehicle\}/);
  assert.match(front, /cma_svb_front_wall_mobile_test_v1:\$\{scope\}:\$\{vehicle\}/);
});
