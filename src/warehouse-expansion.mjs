import { SUPERVISIONS } from './data.js';
import { DEFAULT_STOCK_LOT } from './warehouse-defaults.mjs';

const slug = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// Provisioning template; warehouse-config.mjs explicitly enables validated deployments.
export const STAGED_WAREHOUSE_DEPLOYMENTS = ['Figueres', 'Girona', 'Blanes'].map((zone) => {
  const units = Object.entries(SUPERVISIONS[zone]);
  const towns = [...new Set(units.filter(([unit]) => !unit.startsWith('SUPERVISOR_')).map(([, town]) => town))];
  const warehouses = [zone, ...towns.filter((town) => town !== zone).sort((a, b) => a.localeCompare(b, 'ca'))].map((name) => ({
    id: `lot5_${slug(zone)}_${name === zone ? 'central' : slug(name)}`,
    name, kind: name === zone ? 'central' : 'subwarehouse',
    unitCount: units.filter(([unit, town]) => !unit.startsWith('SUPERVISOR_') && town === name).length,
  }));
  return {
    lot: DEFAULT_STOCK_LOT, zone, enabled: false, initializeRpc: null,
    safetyRpc: 'set_expansion_safety_percentages',
    openingQuantity: 1000, safetyPercentage: 30, warehouses,
    unitAssignments: Object.fromEntries(units.map(([unit, town]) => [
      unit.startsWith('SUPERVISOR_') ? `Material Supervisor · ${zone}` : unit,
      warehouses.find((w) => w.name === (unit.startsWith('SUPERVISOR_') ? zone : town)).id,
    ])),
  };
});

export function planOpeningInventory(config, baseMinimums, materials, existing = []) {
  const seen = new Set(existing.map((row) => JSON.stringify([row.warehouse_id, row.material])));
  return config.warehouses.flatMap((warehouse) => materials.flatMap((material) => {
    if (seen.has(JSON.stringify([warehouse.id, material]))) return [];
    const minimum = baseMinimums[material];
    if (!Number.isSafeInteger(minimum) || minimum < 0) throw new Error(`Missing or invalid Camprodon minimum: ${material}`);
    const weight = warehouse.kind === 'central' ? config.warehouses.reduce((sum, w) => sum + w.unitCount, 0) : warehouse.unitCount;
    const base = minimum * weight;
    return [{ warehouse_id: warehouse.id, material, quantity: config.openingQuantity,
      minimum_base_quantity: base, safety_percentage: config.safetyPercentage,
      minimum_quantity: warehouse.kind === 'central' ? Math.ceil(base * (100 + config.safetyPercentage) / 100) : base }];
  }));
}
