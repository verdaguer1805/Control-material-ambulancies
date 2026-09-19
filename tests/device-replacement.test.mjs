import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../sql/single-active-device-per-unit.sql", import.meta.url), "utf8");

test("activation preview cannot be skipped by a React click event", () => {
  assert.match(source, /onClick=\{\(\) => activateThisDevice\(false\)\}/);
  assert.match(source, /get_device_activation_preview/);
  assert.match(source, /deviceReplacementUnitInput\.trim\(\)\.toUpperCase\(\)/);
  assert.match(source, /onClick=\{\(\) => activateThisDevice\(true\)\}/);
});

test("replacement is atomic and revokes only the previous device for the same lot and unit", () => {
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /where unit = p_unit and lot = p_lot and active and user_id <> v_user_id/);
  assert.match(migration, /set active = false/);
});
