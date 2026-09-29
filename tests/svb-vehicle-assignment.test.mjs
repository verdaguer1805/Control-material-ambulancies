import test from "node:test";
import assert from "node:assert/strict";

import {
  readSvbVehicleAssignment,
  svbVehicleAssignmentKey,
  writeSvbVehicleAssignment,
} from "../src/svb-vehicle-assignment.mjs";

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
  }

  get length() {
    return this.values.size;
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(String(key), String(value));
  }

  key(index) {
    return [...this.values.keys()][index] ?? null;
  }
}

test("the assigned vehicle persists when the guard changes", () => {
  const storage = new MemoryStorage();
  assert.equal(writeSvbVehicleAssignment(storage, "g450", "5439"), true);
  assert.equal(readSvbVehicleAssignment(storage, "G450", "guard-a"), "5439");
  assert.equal(readSvbVehicleAssignment(storage, "G450", "guard-b"), "5439");
  assert.equal(storage.getItem(svbVehicleAssignmentKey("G450")), "5439");
});

test("the current guard legacy assignment is migrated automatically", () => {
  const storage = new MemoryStorage({ "cma_svb_vehicle_label_v1:G450:guard-b": "5527" });
  assert.equal(readSvbVehicleAssignment(storage, "G450", "guard-b"), "5527");
  assert.equal(storage.getItem(svbVehicleAssignmentKey("G450")), "5527");
});

test("a previous guard legacy assignment is recovered when today's key is absent", () => {
  const storage = new MemoryStorage({ "cma_svb_vehicle_label_v1:G450:guard-a": "5439" });
  assert.equal(readSvbVehicleAssignment(storage, "G450", "guard-b"), "5439");
  assert.equal(storage.getItem(svbVehicleAssignmentKey("G450")), "5439");
});

test("invalid vehicle labels are rejected", () => {
  const storage = new MemoryStorage();
  assert.equal(writeSvbVehicleAssignment(storage, "G450", "123"), false);
  assert.equal(readSvbVehicleAssignment(storage, "G450", "guard-a"), "");
});
