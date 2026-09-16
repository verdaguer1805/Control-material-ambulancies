// Deployment configuration, separate from the shared stock screens.
// A selector entry is not an enabled warehouse deployment. Add a zone here
// only after its database, assignments, permissions and minimum rules are ready.
import { DEFAULT_STOCK_LOT, DEFAULT_STOCK_ZONE } from './warehouse-defaults.mjs';
import { STAGED_WAREHOUSE_DEPLOYMENTS } from './warehouse-expansion.mjs';
export { DEFAULT_STOCK_LOT, DEFAULT_STOCK_ZONE } from './warehouse-defaults.mjs';

export const WAREHOUSE_DEPLOYMENTS = [{
  lot: DEFAULT_STOCK_LOT,
  zone: DEFAULT_STOCK_ZONE,
  enabled: true,
  initializeRpc: "initialize_olot_inventory",
  safetyRpc: "set_inventory_safety_percentages",
  defaultTransferWarehouseId: "lot5_olot_camprodon",
  warehouses: [
    { id: "lot5_olot_central", name: "Olot", kind: "central" },
    { id: "lot5_olot_banyoles", name: "Banyoles", kind: "subwarehouse" },
    { id: "lot5_olot_campdevanol", name: "Campdevànol", kind: "subwarehouse" },
    { id: "lot5_olot_camprodon", name: "Camprodon", kind: "subwarehouse" },
    { id: "lot5_olot_sant_joan", name: "Sant Joan de les Abadesses", kind: "subwarehouse" },
  ],
  // Existing assignments are preserved, including units excluded from the
  // separate central-minimum calculation. These are not minimum weights.
  unitAssignments: {
    G205: "lot5_olot_central", G450: "lot5_olot_central",
    G451: "lot5_olot_central", BP52: "lot5_olot_central",
    G413: "lot5_olot_banyoles", G215: "lot5_olot_campdevanol",
    G452: "lot5_olot_campdevanol", G453: "lot5_olot_camprodon",
    G305: "lot5_olot_sant_joan",
  },
}, ...STAGED_WAREHOUSE_DEPLOYMENTS.map((config) => ({ ...config, enabled: true }))];

export function getWarehouseScope(lot, zone, deployments = WAREHOUSE_DEPLOYMENTS) {
  const config = deployments.find((item) => item.enabled && item.lot === lot && item.zone === zone);
  if (!config) return null;
  const central = config.warehouses.filter((item) => item.kind === "central");
  if (central.length !== 1) throw new Error("A stock zone must have exactly one central warehouse");
  const warehouses = [central[0], ...config.warehouses.filter((item) => item.kind === "subwarehouse")];
  const label = (item) => `${item.kind === "central" ? "Almacén central" : "Subalmacén"} ${item.name}`;
  if (new Set(warehouses.map((item) => item.id)).size !== warehouses.length ||
      new Set(warehouses.map(label)).size !== warehouses.length) throw new Error("Duplicate warehouse configuration");
  const ids = warehouses.map((item) => item.id);
  if (Object.values(config.unitAssignments).some((id) => !ids.includes(id))) throw new Error("Unit assigned outside its stock zone");
  return {
    ...config,
    key: JSON.stringify([lot, zone]),
    central: central[0],
    centralLabel: label(central[0]),
    locations: warehouses.map(label),
    remoteIds: Object.fromEntries(warehouses.map((item) => [label(item), item.id])),
    warehouseIds: ids,
  };
}

export function canAccessWarehouseScope(access, scope) {
  if (!scope) return false;
  if (["owner", "logistics"].includes(access?.role)) return true;
  return access?.role === "supervisor" && access.zone === scope.zone &&
    (!access.lot || access.lot === scope.lot);
}
