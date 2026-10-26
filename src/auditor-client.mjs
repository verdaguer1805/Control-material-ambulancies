import {madridDateTime} from './report-datetime.mjs';
export const AUDITOR_MODE_KEY='cma_mobile_role_v1';
export const AUDITOR_WORK_KEY='cma_auditor_material_draft_v1';
export const auditorNeedsSetup=value=>!value||value.active!==true;
export function clearAuditorLocalProfile(storage){
 storage.removeItem(AUDITOR_MODE_KEY);storage.removeItem(AUDITOR_WORK_KEY);storage.removeItem('cma_auditor_verified_profile_v1');
 // Canceling entry to the auditor must not remove an existing operational unit.
 const wasAuditor=String(storage.getItem('cma_unit')||'').startsWith('Auditor ·');
 if(wasAuditor){storage.removeItem('cma_unit');storage.removeItem('cma_authorized_auth_identity_v1');}
 return wasAuditor;
}
export const sameAuditorMaterials=(a={},b={})=>{
 const ak=Object.keys(a).sort(),bk=Object.keys(b).sort();
 return ak.length===bk.length&&ak.every((key,index)=>key===bk[index]&&a[key]===b[key]);
};
export function confirmedAuditorProfile(value,expected=null){
 if(!value?.verified || !value.active || !value.user_id || !Number.isInteger(value.revision) || !value.full_name || !value.warehouse_name || !value.warehouse_id || !value.lot || !value.zone)return null;
 if(expected && ['full_name','lot','zone','warehouse_id'].some(key=>value[key]!==expected[key]))return null;
 return value;
}
export function auditorReportRecords(rows){
 return rows.map(row=>({...madridDateTime(row.created_at),id:row.id,unit:`Auditor · ${row.zone} · ${row.full_name}`,zone:row.zone,lot:row.lot,origin:'Auditor',warehouse:row.warehouse_name,createdAt:row.created_at,updatedAt:row.created_at,entries:[{createdAt:row.created_at,materials:row.materials}],synced:true}));
}
export function auditorTransitionIssue(storage,selected={}){
 if(Object.values(selected).some(Number))return 'Envía primero el material seleccionado.';
 const parse=key=>{try{return JSON.parse(storage.getItem(key)||'null');}catch{return null;}};
 const records=parse('cma_records')||[],audits=parse('cma_supervisor_vehicle_audits_v1')||[];
 if(!Array.isArray(records)||!Array.isArray(audits))return 'No se han podido comprobar los registros de este móvil. No se ha cambiado el perfil.';
 if(records.some(record=>!record.synced))return 'Sincroniza los registros pendientes antes de cambiar de perfil.';
 if(audits.some(row=>!row.confirmedAt))return 'Termina y envía primero la auditoría pendiente.';
 for(let i=0;i<storage.length;i++){
  const key=storage.key(i),value=parse(key);
  if(key.startsWith('cma_supervisor_unsent_v1:')&&Object.values(value||{}).some(Number))return 'Envía primero el material de supervisión pendiente.';
  if(/cma_tsnu.*outbox/.test(key)&&Array.isArray(value)&&value.length)return 'Sincroniza los registros TSNU pendientes.';
 }
 const work=parse(AUDITOR_WORK_KEY);
 if(work&&Object.values(work.materials||{}).some(Number))return 'Envía primero el consumo pendiente del auditor.';
 const context=parse('cma_svb_checklist_context_v1');
 if(context?.unit&&context?.guardCode&&(!context.guardEndsAt||new Date(context.guardEndsAt)>new Date())){
  for(let i=0;i<storage.length;i++){
   const key=storage.key(i);
   if(!key.startsWith('cma_svb_')||!key.includes(`:${context.unit}:${context.guardCode}:`))continue;
   if(!key.includes('_mobile_test_v1:'))continue;
   const vehicle=key.split(':').at(-1),answers=parse(key);
   if(answers&&Object.keys(answers).length&&!storage.getItem(`cma_svb_submitted_v1:${context.unit}:${context.guardCode}:${vehicle}`))return 'Hay un checklist comenzado sin enviar. Resuélvelo antes de cambiar de perfil.';
  }
 }
 return '';
}
export function auditorError(error){
 const message=String(error?.message||error||'');
 for(const [code,text] of Object.entries({
  AUDITOR_PENDING_WORK:'Termina y envía las auditorías y consumos pendientes antes de cambiar de zona.',
  AUDITOR_NOT_AUTHORIZED:'Este móvil no tiene autorización de auditor o su acceso ha sido revocado.',
  AUDITOR_REQUEST_TIMEOUT:'No se ha recibido confirmación a tiempo. Los datos siguen guardados. Vuelve a verificar antes de repetir la operación.',
  AUDITOR_ASSIGNMENT_CHANGED:'La asignación ha cambiado. Verifica de nuevo el almacén antes de enviar.',
  AUDITOR_WAREHOUSE_MISMATCH:'El almacén no coincide con la asignación validada. No se ha descontado material.',
  INVALID_AUDITOR_AUTHORIZATION:'Código incorrecto o sin permiso para esta zona.',
  AUDITOR_ACCESS_LOCKED:'Demasiados intentos. Espera 15 minutos antes de volver a autorizar.',
  AUDITOR_FULL_NAME_REQUIRED:'Introduce nombre y apellidos.',
  UNIT_SHIFT_MUST_BE_CLOSED:'Finaliza primero la guardia TSNU de este móvil.',
  INVENTORY_ITEM_NOT_FOUND:'El material no está configurado en el almacén asignado. No se ha registrado el consumo.',
 }))if(message.includes(code))return text;
 return 'No se ha podido confirmar con el servidor. Los datos siguen guardados; vuelve a intentarlo.';
}
export function mapServerAuditorDraft(row){
  return {id:row.id,auditorUserId:row.user_id,profileRevision:row.profile_revision,warehouseId:row.warehouse_id,supervisor:`Auditor · ${row.zone} · ${row.full_name}`,lot:row.lot,zone:row.zone,vehicle:row.vehicle,type:row.checklist_type,startedAt:row.started_at,catalog:row.catalog,answers:row.answers||{},notes:row.notes||{},confirmedAt:row.submitted_at,editVersion:Number(row.edit_version||0)};
}
