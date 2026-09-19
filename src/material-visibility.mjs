export const MATERIAL_VISIBILITY_CACHE = "cma_material_visibility_v1";

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

export function readMaterialVisibility(storage, fallback) {
  try {
    const saved = JSON.parse(storage.getItem(MATERIAL_VISIBILITY_CACHE) || "null");
    return saved && typeof saved === "object" ? { ...fallback, ...saved } : fallback;
  } catch {
    return fallback;
  }
}

export function saveMaterialVisibility(storage, visibility) {
  storage.setItem(MATERIAL_VISIBILITY_CACHE, JSON.stringify(visibility));
}
