import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { SVB_CABIN_ITEMS, cabinStatus } from "../src/svb-cabin-data.mjs";

test("driver cabin contains the eleven requested entries and quantities",()=>{
  assert.equal(SVB_CABIN_ITEMS.length,11);
  assert.ok(SVB_CABIN_ITEMS.includes("Casco · 3 unidades"));
  assert.ok(SVB_CABIN_ITEMS.includes("Detector de monóxido · 2 unidades"));
  assert.ok(SVB_CABIN_ITEMS.includes("Cargador base Sepura · 2 unidades"));
  assert.ok(SVB_CABIN_ITEMS.includes("Batería de repuesto Sepura · 2 unidades"));
});
test("cabin remains pending until every item is checked and preserves incidents",()=>{
  assert.equal(cabinStatus({}),"pending");
  const items=Object.fromEntries(SVB_CABIN_ITEMS.map(item=>[item,"ok"]));
  assert.equal(cabinStatus({1:items}),"ok");
  items[SVB_CABIN_ITEMS[0]]="issue";
  assert.equal(cabinStatus({1:items}),"issue");
  delete items[SVB_CABIN_ITEMS[1]];
  assert.equal(cabinStatus({1:items}),"pending");
});
test("four-zone menu, submission, reports and offline assets include the cabin",()=>{
  const read=file=>fs.readFileSync(new URL("../"+file,import.meta.url),"utf8");
  assert.match(read("public/svb-zones.html"),/id="cabin".*svb-cabin.html/);
  const production=read("public/checklists/svb-zones-production.js");
  assert.match(production,/\["left","front","right","cabin"\]/);
  assert.match(production,/cabin:zoneAnswers\("cabin"\)/);
  assert.match(production,/Completa las cuatro zonas/);
  assert.match(read("src/main.jsx"),/"Cabina de conducción": zoneState\("cabin"\)/);
  assert.match(read("public/checklists/svb-cabin.js"),/cma_svb_cabin_wall_mobile_test_v1:\$\{scope\}:\$\{vehicle\}/);
  assert.match(read("public/sw.js"),/svb-cabin.html/);
  assert.equal(read("src/svb-cabin-data.mjs"),read("public/checklists/svb-cabin-data.js"));
});
