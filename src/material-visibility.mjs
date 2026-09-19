export const MATERIAL_VISIBILITY_CACHE = "cma_material_visibility_v2";

const key = (value) => String(value || "").trim().toLocaleLowerCase("es");

export function defaultMaterialVisibility(materials, hiddenMaterials) {
  const hidden = new Set(hiddenMaterials.map(key));
  return Object.fromEntries(materials.map((material) => [material, !hidden.has(key(material))]));
}

export function materialVisibilityFromRows(materials, fallback, rows) {
  const remote = new Map((rows || []).map((row) => [key(row.material), row.unit_visible !== false]));
  return Object.fromEntries(
    materials.map((material) => [material, remote.has(key(material)) ? remote.get(key(material)) : fallback[material] !== false]),
  );
}

const scopeKey = (lot, zone) => `${String(lot || "").trim()}::${String(zone || "").trim()}`;

export function readMaterialVisibility(storage, fallback, lot, zone) {
  try {
    const allSaved = JSON.parse(storage.getItem(MATERIAL_VISIBILITY_CACHE) || "null");
    const saved = allSaved?.[scopeKey(lot, zone)];
    return saved && typeof saved === "object" ? { ...fallback, ...saved } : fallback;
  } catch {
    return fallback;
  }
}

export function saveMaterialVisibility(storage, visibility, lot, zone) {
  let allSaved = {};
  try { allSaved = JSON.parse(storage.getItem(MATERIAL_VISIBILITY_CACHE) || "{}") || {}; } catch { /* cache nou */ }
  allSaved[scopeKey(lot, zone)] = visibility;
  storage.setItem(MATERIAL_VISIBILITY_CACHE, JSON.stringify(allSaved));
}
