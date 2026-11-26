import {requireAuditScope} from './auditor-offline.mjs';

// Reauthorization is NOT a reassignment. Keep the same device and revision.
export function canRecoverAuditor(profile,expected,drafts=[],work=null){
 if(!profile?.user_id || profile.active!==false || !Number.isInteger(profile.revision))return false;
 if(['full_name','lot','zone','warehouse_id'].some(k=>profile[k]!==expected[k]))return false;
 try{
  for(const d of drafts.filter(d=>!d.confirmedAt))requireAuditScope(d,profile);
  if(work&&Object.values(work.materials||{}).some(Number)&&work.revision!==profile.revision)return false;
 }catch{return false;}
 return true;
}
