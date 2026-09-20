import test from "node:test";
import assert from "node:assert/strict";
import { syncPendingIndependently } from "../src/pending-sync.mjs";

const record = (id) => ({ id, unit: "G451", lot: "Lot 5", synced: false, pendingUpdate: true });

test("a failed previous guard never blocks the current guard", async () => {
  const previous = record("190926");
  const current = record("200926");
  const sent = [];
  const result = await syncPendingIndependently([previous, current], async (item) => {
    if (item === previous) throw new Error("GUARD_RECOVERY_REQUIRED");
    sent.push(item.id);
  });

  assert.deepEqual(sent, ["200926"]);
  assert.equal(previous.synced, false);
  assert.equal(previous.lastSyncError, "GUARD_RECOVERY_REQUIRED");
  assert.equal(current.synced, true);
  assert.equal(result.failed.length, 1);
  assert.equal(result.synced.length, 1);
});

test("a successful retry clears the stored error without duplicating state", async () => {
  const pending = { ...record("190926"), lastSyncError: "TEMPORARY" };
  const result = await syncPendingIndependently([pending], async () => {});
  assert.equal(pending.synced, true);
  assert.equal("lastSyncError" in pending, false);
  assert.equal(result.synced.length, 1);
});

test("authorization failure stops later requests from the same device", async () => {
  const first = record("190926");
  const second = record("200926");
  let calls = 0;
  const result = await syncPendingIndependently([first, second], async () => {
    calls += 1;
    throw new Error("DEVICE_NOT_AUTHORIZED");
  });
  assert.equal(calls, 1);
  assert.equal(result.failed.length, 1);
  assert.match(String(result.stopped?.message), /DEVICE_NOT_AUTHORIZED/);
  assert.equal(second.synced, false);
});

test("conflicted records are skipped without blocking valid records", async () => {
  const conflict = { ...record("190926"), conflict: true };
  const current = record("200926");
  const result = await syncPendingIndependently([conflict, current], async () => {});
  assert.equal(result.conflict, conflict);
  assert.equal(conflict.synced, false);
  assert.equal(current.synced, true);
});
