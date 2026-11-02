export const vehicleCacheKey = (lot,vehicle) => `cma_vehicle_identity_v1:${encodeURIComponent(lot)}:${encodeURIComponent(vehicle)}`;
export function readCachedVehicle(storage,lot,vehicle) {
  try { const row=JSON.parse(storage.getItem(vehicleCacheKey(lot,vehicle))||'null');return row?.verified===true && row.lot===lot && row.vehicle===vehicle && typeof row.plate==='string' && row.plate ? row : null; } catch { return null; }
}
export function cacheConfirmedVehicle(storage,row,lot,vehicle) {
  if(row?.verified!==true||row.lot!==lot||row.vehicle!==vehicle||!row.plate)throw new Error('No se han confirmado los datos del vehículo.');
  const cached={verified:true,lot,vehicle,plate:row.plate,cachedAt:new Date().toISOString()};
  storage.setItem(vehicleCacheKey(lot,vehicle),JSON.stringify(cached));return cached;
}
