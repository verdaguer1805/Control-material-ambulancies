import assert from "node:assert/strict";
import test from "node:test";

import { MATERIALS, SUPERVISOR_ONLY_MATERIALS } from "../src/data.js";
import { defaultMaterialVisibility, materialVisibilityFromRows } from "../src/material-visibility.mjs";

test("la visibilidad remota manda sobre la lista histórica", () => {
  const fallback = defaultMaterialVisibility(MATERIALS, SUPERVISOR_ONLY_MATERIALS);
  const result = materialVisibilityFromRows(MATERIALS, fallback, [
    { material: "Pilas AA", unit_visible: false },
    { material: "Papel WC", unit_visible: true },
  ]);
  assert.equal(result["Pilas AA"], false);
  assert.equal(result["Papel WC"], true);
  assert.equal(result["Pilas AAA"], true);
});

test("un material supervisor puede ser visible para unidades", () => {
  const fallback = defaultMaterialVisibility(MATERIALS, SUPERVISOR_ONLY_MATERIALS);
  const result = materialVisibilityFromRows(MATERIALS, fallback, [
    { material: "Parches schiller adulto", supply_type: "supervisor", unit_visible: true },
  ]);
  assert.equal(result["Parches schiller adulto"], true);
});
