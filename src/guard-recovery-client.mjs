export const GUARD_HANDOFF_KEY='cma_guard_handoff_required_v1';
export function restoreGuardRecord(records, snapshot, context) {
 if(!snapshot?.token || snapshot.unit!==context.serverUnit || snapshot.lot!==context.lot || snapshot.guard_code!==context.code || Date.parse(snapshot.occurred_at)!==Date.parse(context.start)) throw new Error('INVALID_GUARD_SNAPSHOT');
 const materials=snapshot.materials;
 if(!materials || typeof materials!=='object' || Array.isArray(materials) || Object.values(materials).some(q=>!Number.isInteger(q)||q<0)) throw new Error('INVALID_GUARD_SNAPSHOT');
 if(records.some(r=>r.unit===context.unit && r.id===context.code && !r.synced)) throw new Error('LOCAL_PENDING_REQUIRES_REVIEW');
 const recovered={id:context.code,unit:context.unit,lot:context.lot,warehouse:context.warehouse,date:context.date,time:context.time,
  createdAt:snapshot.occurred_at,updatedAt:snapshot.occurred_at,guardOccurredAt:snapshot.occurred_at,
  recoveryToken:snapshot.token,recoveryUserId:snapshot.user_id,serverIncidentId:snapshot.incident_id,
  recoveredBaseline:true,synced:true,pendingUpdate:false,
  entries:[{createdAt:snapshot.occurred_at,materials:{...materials},recovered:true}]};
 return [...records.filter(r=>!(r.unit===context.unit && r.id===context.code)),recovered];
}
export function guardSaveRequest(record, serverUnit, warehouse) {
 const materials={};
 for(const entry of record.entries || []) for(const [key,value] of Object.entries(entry.materials || {})) materials[key]=(materials[key] || 0)+value;
 const occurred=record.guardOccurredAt || new Date(`${record.date}T${record.time || '00:00'}`).toISOString();
 if(record.recoveryToken) return {name:'save_recovered_guard_consumption',args:{p_token:record.recoveryToken,p_unit:serverUnit,p_lot:record.lot,p_guard_code:record.id,p_occurred_at:occurred,p_materials:materials}};
 return {name:'save_guard_consumption',args:{p_incident_code:record.id,p_unit:serverUnit,p_warehouse:warehouse,p_occurred_at:occurred,p_materials:materials}};
}
export function recoveryErrorMessage(error) {
 const text=String(error?.message || error || '');
 if(text.includes('MULTIPLE_ACTIVE_DEVICES')) return 'Hay más de un dispositivo activo para esta unidad. Revoca el anterior antes de continuar.';
 if(text.includes('LOCAL_PENDING_REQUIRES_REVIEW')) return 'Este dispositivo tiene consumos pendientes. No se han borrado: hay que revisarlos antes del cambio.';
 if(text.includes('DEVICE_NOT_AUTHORIZED')) return 'Dispositivo sin autorización vigente. Los consumos pendientes se conservan.';
 if(/GUARD_RECOVERY_REQUIRED|STALE_GUARD_TOTAL|GUARD_START_MISMATCH|CLIENT_UPGRADE_REQUIRED/.test(text)) return 'No se ha enviado para proteger los consumos anteriores. Actualiza la app y contacta con supervisión para recuperar la guardia.';
 return 'No se ha podido recuperar la guardia. Comprueba la conexión y vuelve a intentarlo. No envíes desde el dispositivo anterior.';
}
