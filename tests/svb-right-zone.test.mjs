import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { SVB_RIGHT_ZONE_SECTIONS, rightZoneStatus } from "../src/svb-right-zone-data.mjs";

test("la zona derecha contiene los puntos previstos y no crea el compartimento 7 inexistente", () => {
  assert.deepEqual(SVB_RIGHT_ZONE_SECTIONS.map(({ id }) => id), [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12]);
  assert.match(SVB_RIGHT_ZONE_SECTIONS[3].items.join(" "), /Suero fisiológico 5 ml · 10 unidades/);
  assert.match(SVB_RIGHT_ZONE_SECTIONS[5].items.join(" "), /Gasa estéril 40 × 20 · 20 unidades/);
  assert.match(SVB_RIGHT_ZONE_SECTIONS[9].items.join(" "), /Bolsa de basura · 1 paquete/);
  assert.deepEqual(SVB_RIGHT_ZONE_SECTIONS[10].items, ["Extintor · 1 unidad", "Cinta de balizar · 1 unidad"]);
});

test("un punto solo queda verde cuando todos sus elementos son correctos", () => {
  const section = SVB_RIGHT_ZONE_SECTIONS[1];
  assert.equal(rightZoneStatus(section, {}), "pending");
  assert.equal(rightZoneStatus(section, { 2: { [section.items[0]]: "ok" } }), "pending");
  assert.equal(rightZoneStatus(section, { 2: Object.fromEntries(section.items.map((item) => [item, "ok"])) }), "ok");
  assert.equal(rightZoneStatus(section, { 2: { [section.items[0]]: "ok", [section.items[1]]: "issue" } }), "issue");
});

test("la pantalla derecha usa foto móvil, borrador aislado y textos en castellano", () => {
  const html = fs.readFileSync(new URL("../public/svb-right-preview.html", import.meta.url), "utf8");
  assert.match(html, /svb-zona-derecha-mobile\.jpg/);
  assert.match(html, /cma_svb_right_zone_mobile_test_v1/);
  assert.match(html, /Zona derecha/);
  assert.match(html, /NO ENVÍA DATOS/);
});
