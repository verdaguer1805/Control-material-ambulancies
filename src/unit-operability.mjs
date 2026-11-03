export const INOPERABILITY_REASONS = [
  ['material', 'Reposición o cambio de material'],
  ['accident', 'Accidente'],
  ['cleaning', 'Desinfección o limpieza del vehículo'],
  ['staff', 'Falta de técnico/a'],
  ['maintenance', 'Avería o mantenimiento del vehículo'],
];
export function canUnitDeclareInoperability(unit,service='TSU') {
  return Boolean(unit && service==='TSU' && !/^(?:Material supervisor|SUPERVISOR_|Auditor|(?:T|KE?|K)\d)/i.test(unit));
}
export const operabilityKey = (lot, unit) => `cma_unit_operability_v1:${encodeURIComponent(lot)}:${encodeURIComponent(unit)}`;
export function readOperability(storage, lot, unit) {
  try { const value=JSON.parse(storage.getItem(operabilityKey(lot,unit))||'null');return value?.lot===lot && value?.unit===unit ? value : null; } catch { return null; }
}
export function saveOperability(storage, value) { storage.setItem(operabilityKey(value.lot,value.unit),JSON.stringify(value)); }
export function operabilityStart({lot,unit,vehicle,reason,hasPatient,incidentReference='',description='',justification=''}, id, now=new Date()) {
  if(!lot||!unit||!String(vehicle||'').trim())throw new Error('Selecciona el vehículo que lleva la unidad en este momento.');
  if(!INOPERABILITY_REASONS.some(([key])=>key===reason))throw new Error('Selecciona el motivo de inoperatividad.');
  if(!['yes','no'].includes(hasPatient))throw new Error('Indica si se ha producido estando activados, asistiendo o trasladando a algún afectado.');
  const reference=hasPatient==='yes'?String(incidentReference).trim():'';
  if(hasPatient==='yes'&&!reference)throw new Error('Introduce el número ID del incidente.');
  if(reference.length>100||/[\u0000-\u001f\u007f]/.test(reference))throw new Error('Revisa el número ID del incidente (máximo 100 caracteres).');
  if(description.length>4000||justification.length>4000)throw new Error('Las observaciones no pueden superar los 4000 caracteres.');
  return {type:'start',id,lot,unit,vehicle:String(vehicle).trim().toUpperCase(),reason,hasPatient:hasPatient==='yes',incidentReference:reference,description:description.trim(),justification:justification.trim(),at:now.toISOString()};
}
export function operabilityClose({lot,unit,incidentId,resolution=''},id,now=new Date()) {
  if(!incidentId)throw new Error('No hay una inoperatividad confirmada para cerrar.');
  if(resolution.length>4000)throw new Error('La resolución no puede superar los 4000 caracteres.');
  return {type:'close',id,incidentId,lot,unit,resolution:resolution.trim(),at:now.toISOString()};
}
export function operabilityRequest(operation) {
  const scope={p_expected_lot:operation.lot,p_expected_unit:operation.unit};
  if(operation.type==='start'){
    const args={...scope,p_id:operation.id,p_vehicle:operation.vehicle,p_reason:operation.reason,p_has_patient:operation.hasPatient,p_description:operation.description,p_justification:operation.justification,p_started_at:operation.at};
    // Queued records from older clients keep their original API and meaning.
    return Object.hasOwn(operation,'incidentReference')?['start_my_unit_inoperability_v2',{...args,p_external_incident_id:operation.incidentReference}]:['start_my_unit_inoperability',args];
  }
  if(operation.type==='close')return ['close_my_unit_inoperability',{...scope,p_id:operation.incidentId,p_operation_id:operation.id,p_resolution:operation.resolution,p_ended_at:operation.at}];
  throw new Error('Operación de inoperatividad no válida.');
}
export function confirmedOperability(value,lot,unit) {
  if(!value?.verified||value.lot!==lot||value.unit!==unit||!value.zone||!Array.isArray(value.vehicles))return false;
  return value.active===null || Boolean(value.active?.id && value.active.lot===lot && value.active.unit===unit && !value.active.ended_at);
}
export const operabilityTime = value => value ? new Date(value).toLocaleString('es-ES',{timeZone:'Europe/Madrid',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
export function operabilityError(error) {
  const message=String(error?.message||error||'');
  if(/VEHICLE_NOT_REGISTERED/.test(message))return 'Este vehículo todavía no está en el catálogo. Avisa a supervisión para vincularlo a su matrícula. No se ha comunicado la inoperatividad.';
  if(/UNIT_ALREADY_INOPERATIVE/.test(message))return 'La unidad ya tiene una inoperatividad abierta. Actualiza el estado antes de continuar.';
  if(/DEVICE_NOT_AUTHORIZED|OPERABILITY_SCOPE_CHANGED/.test(message))return 'No se ha confirmado la autorización de esta unidad. No se ha modificado el estado.';
  if(/OPERABILITY_INVALID_TIME/.test(message))return 'Revisa la fecha y hora del móvil. La hora de recuperación no puede ser anterior al inicio.';
  if(/PGRST202|does not exist/.test(message))return 'Esta función todavía no está activada en el servidor.';
  return 'No se ha confirmado la comunicación. Sigue guardada en este móvil como pendiente; pulsa «Reintentar comunicación» cuando recuperes la conexión.';
}
