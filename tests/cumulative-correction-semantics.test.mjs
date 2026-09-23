import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const main = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
const recoveredSql = readFileSync(new URL("../sql/cumulative-guard-consumption-v1.sql", import.meta.url), "utf8");
const correctionSql = readFileSync(new URL("../sql/admin-consumption-corrections-v1.sql", import.meta.url), "utf8");

test("the active guard keeps and replaces one cumulative total", () => {
  assert.match(main, /setQuantities\(activeRecord \? aggregate\(activeRecord\) : \{\}\)/);
  assert.match(main, /rec\.entries = \[entry\]/);
  assert.match(main, /setQuantities\(\{ \.\.\.used \}\)/);
});

test("recovered devices may reduce a total without weakening authorization", () => {
  assert.match(recoveredSql, /require_single_consumption_device/);
  assert.match(recoveredSql, /GUARD_RECOVERY_REQUIRED/);
  assert.doesNotMatch(recoveredSql, /STALE_GUARD_TOTAL/);
  assert.match(recoveredSql, /save_guard_consumption_authorized_impl/);
});

test("admin corrections are post-guard, audited and adjust stock atomically", () => {
  assert.match(correctionSql, /GUARD_STILL_ACTIVE/);
  assert.match(correctionSql, /quantity = quantity \+ v_stock_delta/);
  assert.match(correctionSql, /pending_replenishment = greatest\(0, pending_replenishment - v_stock_delta\)/);
  assert.match(correctionSql, /insert into public\.consumption_corrections/);
  assert.match(correctionSql, /admin_can_access_zone/);
});
