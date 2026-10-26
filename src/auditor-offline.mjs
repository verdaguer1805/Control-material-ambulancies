import {confirmedAuditorProfile} from './auditor-client.mjs';
export const AUDITOR_OFFLINE_KEY='cma_auditor_verified_profile_v1';
const unitFor=p=>`Auditor · ${p.zone} · ${p.full_name}`;
export function readOfflineAuditor(storage){
 try{
  const p=confirmedAuditorProfile(JSON.parse(storage.getItem(AUDITOR_OFFLINE_KEY)||'null'));
  const identity=JSON.parse(storage.getItem('cma_authorized_auth_identity_v1')||'null');
  return p&&storage.getItem('cma_mobile_role_v1')==='auditor'&&storage.getItem('cma_unit')===unitFor(p)&&storage.getItem('cma_lot')===p.lot&&identity?.unit===unitFor(p)&&identity.userId===p.user_id?p:null;
 }catch{return null;}
}
export function rememberOfflineAuditor(storage,profile){
 const p=confirmedAuditorProfile(profile);if(!p)throw new Error('AUDITOR_NOT_AUTHORIZED');
 storage.setItem(AUDITOR_OFFLINE_KEY,JSON.stringify(p));
}
export function auditorConnectionFailure(error){
 return /AUDITOR_OFFLINE|AUDITOR_REQUEST_TIMEOUT|Failed to fetch|fetch failed|NetworkError|Load failed|network request failed|LOCAL_SIMULATED_CONNECTION_FAILURE|AbortError/i.test(String(error?.message||error||''));
}
export function requireAuditScope(draft,profile){
 if(draft.lot!==profile.lot||draft.zone!==profile.zone||draft.supervisor!==`Auditor · ${profile.zone} · ${profile.full_name}`||
  (draft.auditorUserId&&draft.auditorUserId!==profile.user_id)||(draft.profileRevision&&draft.profileRevision!==profile.revision)||(draft.warehouseId&&draft.warehouseId!==profile.warehouse_id))throw new Error('AUDITOR_ASSIGNMENT_CHANGED');
}
export function newestPendingAudit(remote,local){
 const merged=new Map(remote.filter(d=>!d.confirmedAt).map(d=>[d.id,d]));
 for(const d of local.filter(d=>!d.confirmedAt)){
  const r=merged.get(d.id);
  merged.set(d.id,!r||Number(d.editVersion||0)>Number(r.editVersion||0)?d:{...r,sendRequestedAt:d.sendRequestedAt||r.sendRequestedAt});
 }
 return [...merged.values()].sort((a,b)=>Date.parse(a.startedAt||0)-Date.parse(b.startedAt||0)).at(-1);
}
