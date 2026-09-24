import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import XLSX from "xlsx-js-style";
import { DEFAULT_STOCK_LOT, getWarehouseScope, canAccessWarehouseScope } from "../src/warehouse-config.mjs";

const source = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
const fixture = (lot, zone, prefix) => ({
  lot, zone, enabled: true, initializeRpc: "test_initialize", safetyRpc: "test_safety",
  warehouses: [{ id: `${prefix}_central`, name: zone, kind: "central" },
    { id: `${prefix}_sub`, name: "Base de prueba", kind: "subwarehouse" }],
  unitAssignments: { TEST1: `${prefix}_sub` },
});
const figueres = getWarehouseScope("Lote prueba", "Figueres", [fixture("Lote prueba", "Figueres", "test_fig")]);
const otherLot = getWarehouseScope("Otro lote", "Figueres", [fixture("Otro lote", "Figueres", "other_fig")]);

function harness(scope, options = {}) {
  const calls = [], filters = [], messages = [];
  const context = {
    XLSX, Blob, Date, console, AbortController,
    stockScope: scope, stockScopeAllowed: !!scope,
    STOCK_DEMO_CENTRAL: scope?.centralLabel, STOCK_REMOTE_IDS: scope?.remoteIds || {},
    STOCK_DEMO_LOCATIONS: scope?.locations || [], MATERIALS: ["Test"],
    stockRemoteLoaded: true, stockRemoteLoading: false, stockLoadSequence: { current: 0 },
    stockLevel: (_, n) => ({ Test: n }),
    ensureAnonymousSession: async () => {},
    flash: (message) => messages.push(message),
    stockDemo: { levels: { [scope?.centralLabel]: { Test: 100 } } },
    stockMinimums: { [scope?.centralLabel]: { Test: 10 } },
    stockPickerOpen: "entry", stockPickerQuantities: { Test: 3 }, stockDemoTarget: scope?.locations[1], stockPickerTarget: scope?.locations[1],
    confirm: () => true, alert: (message) => messages.push(message), loadRemoteStock: async () => {},
    stockHistoryLoading: false, stockHistoryFrom: "2026-09-16", stockHistoryTo: "2026-09-16", stockHistoryDestination: "",
    materialLabel: (m) => m, saveAs: (blob) => { context.blob = blob; },
    supabase: {
      rpc: async (name, args) => { calls.push({ name, args }); return { error: null }; },
      from: (table) => {
        const query = {};
        for (const method of ["select", "eq", "in", "gte", "lte", "order", "range"]) {
          query[method] = (...args) => { filters.push({ table, method, args }); return query; };
        }
        query.then = (resolve, reject) => Promise.resolve(options.queryResult?.(table) || { data: [], error: null }).then(resolve, reject);
        return query;
      },
    },
  };
  for (const name of ["StockRemoteLoaded", "StockRemoteLoading", "StockMinimums", "StockMinimumBases", "StockSafetyPercentages", "StockPendingReplenishment", "StockMaterialTypes", "StockDemo", "StockPickerOpen", "StockPickerTarget", "StockHistoryMessage", "StockHistoryLoading", "StockHistoryOpen"]) {
    context[`set${name}`] = (value) => { context[`last${name}`] = value; };
  }
  vm.createContext(context);
  const load = (start, end) => {
    const code = source.slice(source.indexOf(start), source.indexOf(end))
      .replace('const XLSX = await import("xlsx-js-style");', "");
    vm.runInContext(code, context);
  };
  return { context, calls, filters, messages, load };
}

test("Olot keeps exact production warehouse IDs and all nine unit assignments", () => {
  const scope = getWarehouseScope(DEFAULT_STOCK_LOT, "Olot");
  assert.equal(scope.central.id, "lot5_olot_central");
  assert.deepEqual(scope.warehouseIds, ["lot5_olot_central", "lot5_olot_banyoles", "lot5_olot_campdevanol", "lot5_olot_camprodon", "lot5_olot_sant_joan"]);
  assert.equal(Object.keys(scope.unitAssignments).length, 9);
  assert.equal(scope.unitAssignments.G413, "lot5_olot_banyoles");
  assert.equal(scope.initializeRpc, "initialize_olot_inventory");
  assert.equal(scope.safetyRpc, "set_inventory_safety_percentages");
});

test("unconfigured zones and lots do not fall back to Olot", () => {
  for (const zone of ["Unknown", "Barcelona"]) assert.equal(getWarehouseScope(DEFAULT_STOCK_LOT, zone), null);
  assert.equal(getWarehouseScope("Lot 7", "Olot"), null);
  assert.notEqual(figueres.key, otherLot.key);
  assert.notDeepEqual(figueres.warehouseIds, otherLot.warehouseIds);
});

test("role/zone access stays restricted and invalid configuration is rejected", () => {
  assert(canAccessWarehouseScope({ role: "owner" }, figueres));
  assert(canAccessWarehouseScope({ role: "logistics" }, figueres));
  assert(canAccessWarehouseScope({ role: "supervisor", zone: "Figueres" }, figueres));
  assert(!canAccessWarehouseScope({ role: "supervisor", zone: "Olot" }, figueres));
  assert(!canAccessWarehouseScope({ role: "supervisor", zone: "Figueres", lot: "Wrong lot" }, figueres));
  assert(!canAccessWarehouseScope({ role: "owner" }, null));
  const bad = fixture("Test", "Bad", "bad");
  bad.unitAssignments.TEST1 = "outside";
  assert.throws(() => getWarehouseScope("Test", "Bad", [bad]), /outside/);
});

test("receipt and transfer use the selected zone IDs, never Olot", async () => {
  for (const scope of [figueres, otherLot, getWarehouseScope(DEFAULT_STOCK_LOT, "Olot")]) {
    const h = harness(scope);
    h.load("  async function applyStockPicker()", "  async function openStockHistory()");
    await h.context.applyStockPicker();
    assert.equal(h.calls[0].args.p_warehouse_id, scope.central.id);
    h.context.stockPickerOpen = "transfer";
    await h.context.applyStockPicker();
    assert.equal(h.calls[1].args.p_origin_id, scope.central.id);
    assert.equal(h.calls[1].args.p_destination_id, scope.warehouseIds[1]);
    h.context.stockDemoTarget = "Subalmacén fuera de zona";
    await h.context.applyStockPicker();
    assert.equal(h.calls[2].args.p_destination_id, scope.warehouseIds[1], "the open operation keeps its confirmed destination");
    h.context.stockPickerTarget = "Subalmacén fuera de zona";
    await h.context.applyStockPicker();
    assert.equal(h.calls.length, 3);
  }
});

test("inactive scope cannot initialize inventory or submit material", async () => {
  const h = harness(null);
  h.load("  async function loadRemoteStock()", "  function openStockPicker(");
  h.load("  async function applyStockPicker()", "  async function openStockHistory()");
  await h.context.loadRemoteStock();
  await h.context.applyStockPicker();
  assert.equal(h.calls.length, 0);
  assert.equal(h.filters.length, 0);
});

test("stock load reads only selected warehouses and ignores stale response", async () => {
  let release;
  const delayed = new Promise((resolve) => { release = resolve; });
  const h = harness(figueres, { queryResult: (table) => table === "warehouse_inventory" ? delayed : { data: [], error: null } });
  h.load("  async function loadRemoteStock()", "  function openStockPicker(");
  const loading = h.context.loadRemoteStock();
  await new Promise((resolve) => setImmediate(resolve));
  h.context.stockLoadSequence.current++;
  release({ data: [], error: null });
  await loading;
  assert.equal(h.context.lastStockDemo, undefined);
  assert.deepEqual(h.filters.filter((f) => f.method === "eq").map((f) => f.args[1]), figueres.warehouseIds);
});

test("history is restricted to selected warehouse IDs and retains receipt/transfer labels", async () => {
  const rows = [{ id: 1, warehouse_id: figueres.central.id, movement_type: "central_receipt", delta: 25, material: "Test", created_at: "2026-09-16T10:00:00Z" },
    { id: 2, warehouse_id: figueres.warehouseIds[1], movement_type: "transfer_in", delta: 3, material: "Test", created_at: "2026-09-16T11:00:00Z", performed_role: "logistics" }];
  const h = harness(figueres, { queryResult: () => ({ data: rows, error: null }) });
  h.load("  async function exportStockHistoryExcel()", "  async function openStockInventoryEditor()");
  await h.context.exportStockHistoryExcel();
  const filter = h.filters.find((f) => f.method === "in" && f.args[0] === "warehouse_id");
  assert.deepEqual(filter.args[1], figueres.warehouseIds);
  const wb = XLSX.read(await h.context.blob.arrayBuffer(), { type: "array" });
  const out = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  assert.equal(out[0].Destino, figueres.centralLabel);
  assert.equal(out[0].Cantidad, 25);
  assert.equal(out[1].Origen, figueres.centralLabel);
  assert.equal(out[1].Cantidad, 3);
  assert.equal(h.calls.length, 0);
  h.context.stockHistoryDestination = "lot5_olot_central";
  h.filters.length = 0;
  await h.context.exportStockHistoryExcel();
  assert.equal(h.filters.length, 0);
});

test("inventory editor cannot save a draft into a different selected warehouse", async () => {
  const h = harness(figueres);
  Object.assign(h.context, {
    stockInventorySaving: false, stockInventoryTarget: { location: figueres.locations[1], id: figueres.warehouseIds[1] },
    stockDemoLocation: figueres.centralLabel, stockDemoReady: true,
    stockInventoryDrafts: { Test: "40" }, stockInventoryOriginals: { Test: "2" },
    setStockInventoryEditOpen: () => {}, setStockInventorySaving: () => {},
    setTimeout: () => 0, clearTimeout: () => {},
  });
  h.context.supabase.rpc = (name, args) => {
    h.calls.push({ name, args }); return { abortSignal: async () => ({ error: null }) };
  };
  h.load("  async function saveStockInventory()", "  async function openStockMinimumEditor()");
  await h.context.saveStockInventory();
  assert.equal(h.calls.length, 0);
  h.context.stockDemoLocation = figueres.locations[1];
  await h.context.saveStockInventory();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].args.p_warehouse_id, figueres.warehouseIds[1]);
  assert.equal(h.calls[0].args.p_items.Test, 40);
  assert.equal(h.calls[0].args.p_expected.Test, 2);
});

test("minimum quantities and central safety keep separate RPCs in selected scope", async () => {
  const h = harness(figueres);
  Object.assign(h.context, {
    stockDemoLocation: figueres.centralLabel,
    stockMinimumDrafts: { Test: "35" }, stockMinimumOriginals: { Test: "30" },
    setStockMinimumOpen: () => {},
  });
  h.load("  async function saveStockMinimums()", "  async function exportStockInventory()");
  await h.context.saveStockMinimums();
  assert.equal(h.calls[0].name, "set_safety_percentages_optimistic");
  assert.equal(h.calls[0].args.p_warehouse_id, figueres.central.id);
  h.context.stockDemoLocation = figueres.locations[1];
  await h.context.saveStockMinimums();
  assert.equal(h.calls[1].name, "set_inventory_minimums_optimistic");
  assert.equal(h.calls[1].args.p_warehouse_id, figueres.warehouseIds[1]);
});
