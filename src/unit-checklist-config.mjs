export const UNIT_CHECKLIST_KEY = 'cma_unit_checklist_v1';
export const TSU_CHECKLISTS = ['SVB', 'Polivalente', 'Logística'];
// Checklist-only units: deliberately separate from stock/report warehouse mappings.
export const TSNU_UNITS = {
  'Lot 5 · Girona - Alt Maresme': {
    Olot: Object.fromEntries([
      'K1374', 'K1376', 'K1377', 'T1731', 'T1732', 'T1733', 'T1734',
      'T1735', 'T1736', 'T1737', 'T1738', 'T1739', 'T1740', 'T1741',
      'T1742', 'T1743', 'T1744', 'KE1384', 'KE1388',
    ].map(unit => [unit, 'TSNU'])),
  },
};
export function readUnitChecklist(storage, unit, lot) {
  try {
    const value = JSON.parse(storage.getItem(UNIT_CHECKLIST_KEY) || 'null');
    if (value?.unit === unit && value?.lot === lot && ['TSU','TSNU'].includes(value.service)) return value;
  } catch { /* Older assignments keep TSU and their existing settings. */ }
  // Existing operational mobiles need no reassignment or storage reset.
  // An explicit later admin assignment above always takes precedence.
  if (lot === 'Lot 5 · Girona - Alt Maresme' && ['G452','G413','G453'].includes(unit)) {
    return {unit, lot, zone:'Olot', service:'TSU', checklist:'SVB'};
  }
  return {unit, lot, service:'TSU', checklist:''};
}
export function deviceServiceLabel(unit, lot) {
  return Object.values(TSNU_UNITS[lot] || {}).some(units => Object.hasOwn(units, unit)) ? 'TSNU · Solo checklist' : 'TSU / Material';
}
export function managedDeviceZone(device, lots) {
  const zones = lots[device.lot] || {};
  const supervisor = /^Material supervisor\s*·\s*(.+)$/i.exec(device.unit || '');
  if (supervisor && Object.hasOwn(zones, supervisor[1])) return supervisor[1];
  return Object.keys(zones).find(zone => Object.hasOwn(zones[zone], device.unit) || Object.hasOwn(TSNU_UNITS[device.lot]?.[zone] || {}, device.unit)) || '';
}
export function filterManagedDevices(devices, service = 'all', includeRevoked = false, scope = {}, lots = {}) {
  return devices.filter(device => {
    if (scope.lot && device.lot !== scope.lot) return false;
    if (scope.zone && managedDeviceZone(device, lots) !== scope.zone) return false;
    if (!includeRevoked && !device.active) return false;
    const tsnu = deviceServiceLabel(device.unit, device.lot).startsWith('TSNU');
    return service === 'all' || (service === 'TSNU' ? tsnu : !tsnu);
  });
}
export function validateUnitChecklist({service, checklist, unit, lot, zone, shift, supervisor = false}, units) {
  if (!lot || !zone || !unit || !Object.hasOwn(units || {}, unit)) throw new Error('Selecciona una unidad de esta zona');
  if (!['TSU','TSNU'].includes(service)) throw new Error('Selecciona TSU o TSNU');
  if (service === 'TSNU' && !Object.hasOwn(TSNU_UNITS[lot]?.[zone] || {}, unit)) throw new Error('Todavía no hay unidades TSNU configuradas');
  if (supervisor) return {service:'TSU', checklist:'', unit, lot, zone, shift:''};
  if (service === 'TSU' && !TSU_CHECKLISTS.includes(checklist)) throw new Error('Selecciona el tipo de checklist');
  if (service === 'TSU' && !['07:00','08:00','09:00'].includes(shift)) throw new Error('Selecciona la hora de inicio de guardia');
  return {service, checklist:service === 'TSNU' ? 'TSNU' : checklist, unit, lot, zone, shift:service === 'TSNU' ? '' : shift};
}
