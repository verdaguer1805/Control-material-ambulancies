import test from "node:test";
import assert from "node:assert/strict";
import { isolateGuardPending, recoverGuardPendingTransaction } from "../src/guard-pending-recovery.mjs";

test("recovery isolates only the exact unit, lot and current guard", () => {
  const current = { unit: "G451", lot: "Lot 5", id: "200926", synced: false };
  const oldGuard = { unit: "G451", lot: "Lot 5", id: "190926", synced: false };
  const otherUnit = { unit: "G452", lot: "Lot 5", id: "200926", synced: false };
  const otherLot = { unit: "G451", lot: "Lot 7", id: "200926", synced: false };
  const alreadySynced = { unit: "G451", lot: "Lot 5", id: "200926", synced: true };
  const result = isolateGuardPending(
    [current, oldGuard, otherUnit, otherLot, alreadySynced],
    { unit: "g451", lot: "Lot 5", guardCode: "200926" },
  );
  assert.deepEqual(result.affected, [current]);
  assert.deepEqual(result.kept, [oldGuard, otherUnit, otherLot, alreadySynced]);
});

test("legacy records without lot remain recoverable in the selected scope", () => {
  const legacy = { unit: "G451", id: "200926", synced: false };
  const result = isolateGuardPending([legacy], { unit: "G451", lot: "Lot 5", guardCode: "200926" });
  assert.deepEqual(result.affected, [legacy]);
});

test("successful recovery persists only the exact removal", async () => {
  const current = { unit: "G451", lot: "Lot 5", id: "200926", synced: false };
  const old = { unit: "G451", lot: "Lot 5", id: "190926", synced: false };
  const persisted = [];
  const result = await recoverGuardPendingTransaction({
    records: [old, current],
    scope: { unit: "G451", lot: "Lot 5", guardCode: "200926" },
    persist: (records) => persisted.push([...records]),
    recover: async () => {},
  });
  assert.equal(result.recovered, true);
  assert.deepEqual(persisted, [[old]]);
});

test("failed server reconstruction restores every original local record", async () => {
  const current = { unit: "G451", lot: "Lot 5", id: "200926", synced: false };
  const old = { unit: "G451", lot: "Lot 5", id: "190926", synced: false };
  const original = [old, current];
  const persisted = [];
  await assert.rejects(
    recoverGuardPendingTransaction({
      records: original,
      scope: { unit: "G451", lot: "Lot 5", guardCode: "200926" },
      persist: (records) => persisted.push([...records]),
      recover: async () => { throw new Error("SUPABASE_UNAVAILABLE"); },
    }),
    /SUPABASE_UNAVAILABLE/,
  );
  assert.deepEqual(persisted, [[old], original]);
});
