import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const main = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
const recoveredSql = readFileSync(new URL("../sql/cumulative-guard-consumption-v1.sql", import.meta.url), "utf8");
const correctionSql = readFileSync(new URL("../sql/admin-consumption-corrections-v1.sql", import.meta.url), "utf8");
const reportSql = readFileSync(new URL("../sql/admin-report-rpc-v1.sql", import.meta.url), "utf8");
const optimisticSql = readFileSync(new URL("../sql/optimistic-inventory-locking-v1.sql", import.meta.url), "utf8");

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

test("admin reports respect RLS through a scoped server function", () => {
  assert.match(main, /rpc\("get_admin_report_data"/);
  assert.doesNotMatch(main, /from\("incidents"\)\.select\(fields\)/);
  assert.match(reportSql, /admin_can_access_zone\(p_zone\)/);
  assert.match(reportSql, /w\.lot = p_lot and w\.zone = p_zone/);
  assert.match(reportSql, /p_to - p_from > 366/);
});

test("absolute stock and minimum edits reject stale values atomically", () => {
  assert.match(main, /set_inventory_quantities_optimistic/);
  assert.match(main, /set_inventory_minimums_optimistic/);
  assert.match(main, /set_safety_percentages_optimistic/);
  assert.match(main, /p_expected:/);
  assert.match(optimisticSql, /for update/);
  assert.match(optimisticSql, /INVENTORY_CONFLICT/);
  assert.match(optimisticSql, /require_admin_warehouse/);
});
