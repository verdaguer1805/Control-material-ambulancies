import assert from "node:assert/strict";
import test from "node:test";

import { MATERIALS, SUPERVISOR_ONLY_MATERIALS } from "../src/data.js";
import { defaultMaterialVisibility, materialVisibilityFromRows, readMaterialVisibility, saveMaterialVisibility } from "../src/material-visibility.mjs";

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

test("la caché queda separada por lote y zona", () => {
  const values = new Map();
  const storage = { getItem: (name) => values.get(name) || null, setItem: (name, value) => values.set(name, value) };
  const fallback = { "Pilas AA": true };
  saveMaterialVisibility(storage, { "Pilas AA": false }, "Lot 5", "Olot");
  saveMaterialVisibility(storage, { "Pilas AA": true }, "Lot 7", "Barcelona");
  assert.equal(readMaterialVisibility(storage, fallback, "Lot 5", "Olot")["Pilas AA"], false);
  assert.equal(readMaterialVisibility(storage, fallback, "Lot 7", "Barcelona")["Pilas AA"], true);
  assert.equal(readMaterialVisibility(storage, fallback, "Lot 5", "Figueres")["Pilas AA"], true);
});
