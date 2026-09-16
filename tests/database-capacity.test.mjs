import test from "node:test";
import assert from "node:assert/strict";
import { databaseCapacity } from "../src/database-capacity.mjs";
test("Pro reference and percentage", () => {
  assert.equal(databaseCapacity(8192).percent, 100);
  assert.equal(databaseCapacity("4096").percent, 50);
  assert.equal(databaseCapacity(0).percent, 0);
});
test("Invalid measurement is not zero usage", () => {
  for (const v of [null, undefined, "", "bad", -1, Infinity]) assert.equal(databaseCapacity(v), null);
});
test("Overflow stays visible in text but bar is capped", () => {
  assert.equal(databaseCapacity(16384).percent, 200);
  assert.equal(databaseCapacity(16384).barPercent, 100);
});
