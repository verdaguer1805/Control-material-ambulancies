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
  assert.match(source, /svb-zones\.html\?from=pwa-v193/);
  assert.match(source, /serviceWorker\.register\("\.\/sw\.js\?v=193"/);
  assert.match(source, /cma_svb_checklist_context_v1/);
  assert.match(source, /return flash\("Próximamente"\)/);
  assert.match(source, /isTsnuMaterial\(m\)/);
});

test('v193 caches the isolated SVB zone menu and previews for company mobiles', () => {
  const worker = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(worker, /const CACHE = "cma-v193"/);
  assert.match(worker, /\.\/svb-zones\.html/);
  assert.match(worker, /\.\/svb-preview\.html/);
  assert.match(worker, /\.\/svb-front-preview\.html/);
  assert.match(worker, /\.\/svb-right-preview\.html/);
  assert.match(worker, /svb-zona-derecha-mobile\.jpg/);
  assert.match(worker, /svb-right-zone-data\.js/);
  assert.match(worker, /svb-vehicle-assignment\.js/);
  assert.match(worker, /svb-zones-production\.js/);
  assert.match(worker, /svb-paret-lateral-esquerre-mobile\.jpg/);
  assert.match(worker, /svb-paret-frontal-mobile\.jpg/);
});

test('SVB vehicle assignment persists by unit while drafts remain scoped by guard and vehicle', () => {
  const menu = fs.readFileSync(new URL('../public/svb-zones.html', import.meta.url), 'utf8');
  const left = fs.readFileSync(new URL('../public/svb-preview.html', import.meta.url), 'utf8');
  const front = fs.readFileSync(new URL('../public/svb-front-preview.html', import.meta.url), 'utf8');
  const right = fs.readFileSync(new URL('../public/svb-right-preview.html', import.meta.url), 'utf8');
  const production = fs.readFileSync(new URL('../public/checklists/svb-zones-production.js', import.meta.url), 'utf8');
  assert.match(menu, /href="\.\/svb-right-preview\.html"/);
  assert.match(right, /cma_svb_right_zone_mobile_test_v1/);
  const source = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
  assert.match(menu, /Unidad/);
  assert.match(production, /\^\\d\{4\}\$/);
  assert.match(production, /readSvbVehicleAssignment/);
  assert.match(source, /writeSvbVehicleAssignment/);
  assert.match(source, /guardStartedAt/);
  assert.match(menu, /Cambiar vehículo/);
  assert.match(production, /classList\.toggle\("confirmed",valid\)/);
  assert.match(production, /style\.display=valid\?"none":"grid"/);
  assert.match(production, /saveVehicle/);
  assert.match(menu, /class="zones hidden" id="zonesPanel"/);
  assert.match(production, /zonesPanel/);
  assert.match(source, /Rotulación del vehículo TSU/);
  assert.match(source, /Cambiar vehículo SVB/);
  assert.doesNotMatch(source, /Código de propietario o supervisor/);
  assert.match(menu, /Zona izquierda/);
  assert.match(menu, /Zona frontal/);
  assert.match(menu, /Zona derecha/);
  assert.match(left, /cma_svb_left_wall_mobile_test_v1:\$\{scope\}:\$\{vehicle\}/);
  assert.match(front, /cma_svb_front_wall_mobile_test_v1:\$\{scope\}:\$\{vehicle\}/);
  assert.doesNotMatch(left, /Reiniciar esta zona|Reiniciar toda la prueba/);
  assert.doesNotMatch(front, /Reiniciar esta zona/);
  assert.doesNotMatch(right, /Reiniciar esta zona/);
});

test('each SVB compartment can mark all of its material correct in one action', () => {
  for (const file of ['svb-preview.html', 'svb-front-preview.html', 'svb-right-preview.html']) {
    const source = fs.readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8');
    assert.match(source, /Marcar todo correcto/);
    assert.match(source, /function markAll\(/);
    assert.match(source, /Object\.fromEntries/);
    assert.match(source, /className=`mark-all/);
  }
});

test('SVB production requires all zones and submits the authorized guard to Supabase', () => {
  const menu = fs.readFileSync(new URL('../public/svb-zones.html', import.meta.url), 'utf8');
  const production = fs.readFileSync(new URL('../public/checklists/svb-zones-production.js', import.meta.url), 'utf8');
  const sql = fs.readFileSync(new URL('../sql/svb-production-v1.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(menu, /NO ENVÍA DATOS/);
  assert.match(menu, /Finalizar y enviar checklist/);
  assert.match(production, /submit_svb_checklist/);
  assert.match(production, /grant_type=refresh_token/);
  assert.match(production, /response\.status===401/);
  assert.match(production, /error instanceof TypeError/);
  assert.match(production, /ERROR_SUPABASE/);
  assert.match(production, /textContent="v193"/);
  assert.match(production, /states\.every/);
  assert.match(sql, /DEVICE_NOT_AUTHORIZED/);
  assert.match(sql, /unique \(lot, unit, guard_code, vehicle_label\)/);
  assert.match(sql, /on conflict\(lot,unit,guard_code,vehicle_label\) do update/);
});
