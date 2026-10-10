import {TSNU_UNITS} from './unit-checklist-config.mjs';

export function correctionService(unit, lot, zone) {
  if (/^BP/i.test(unit || '')) return 'TSU';
  return Object.hasOwn(TSNU_UNITS[lot]?.[zone] || {}, unit) ? 'TSNU' : 'TSU';
}

export function tsnuCorrectionRows(data) {
  const shifts = new Map((data?.shifts || []).map(s => [s.id, s]));
  return (data?.withdrawals || []).flatMap(row => {
    const shift = shifts.get(row.shift_id);
    if (!shift) return [];
    const date = new Intl.DateTimeFormat('es-ES', {timeZone:'Europe/Madrid',day:'2-digit',month:'2-digit',year:'2-digit'}).format(new Date(shift.started_at)).replaceAll('/', '');
    return [{...row, id:row.operation_id, service:'TSNU', incident_code:date, occurred_at:row.created_at, ended_at:shift.ended_at}];
  }).sort((a,b) => a.unit.localeCompare(b.unit,'es',{numeric:true}) || new Date(a.occurred_at)-new Date(b.occurred_at));
}

export function consumptionCorrectionRequest(row, {lot, material, quantity, previous, reason}) {
  if (row.service === 'TSNU') return ['correct_tsnu_consumption', {
    p_operation_id:row.id, p_lot:lot, p_material:material,
    p_corrected_quantity:quantity, p_expected_quantity:previous, p_reason:reason
  }];
  return ['correct_guard_consumption', {
    p_incident_id:row.id, p_lot:lot, p_material:material, p_corrected_quantity:quantity, p_reason:reason
  }];
}
