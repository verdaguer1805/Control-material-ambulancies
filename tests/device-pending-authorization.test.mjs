import test from "node:test";
import assert from "node:assert/strict";
import { classifyPendingRecords, pendingUnitsLabel } from "../src/device-pending-authorization.mjs";

test("allows pending records from the same unit and lot", () => {
  const result = classifyPendingRecords([
    { unit: "g451", lot: "Lot 5", synced: false },
    { unit: "G451", synced: false },
    { unit: "G452", synced: true },
  ], "G451", "Lot 5");
  assert.equal(result.matching.length, 2);
  assert.equal(result.foreign.length, 0);
});

test("blocks pending records from another unit or explicit lot", () => {
  const result = classifyPendingRecords([
    { unit: "G452", lot: "Lot 5", synced: false },
    { unit: "G451", lot: "Lot 7", synced: false },
  ], "G451", "Lot 5");
  assert.equal(result.matching.length, 0);
  assert.equal(result.foreign.length, 2);
  assert.equal(pendingUnitsLabel(result.foreign), "G452, G451");
});
