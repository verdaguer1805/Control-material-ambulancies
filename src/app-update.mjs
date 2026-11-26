export function releaseFromWorker(source){
 return Number(String(source).match(/const CACHE = "cma-v(\d+)"/)?.[1]||0);
}
export function freshAppUrl(href,version){
 const url=new URL(href);url.searchParams.set('app_update',String(version));return url.href;
}
export function pendingAuditUpdate(storage){
 try{
  const rows=JSON.parse(storage.getItem('cma_supervisor_vehicle_audits_v1')||'[]');
  if(!Array.isArray(rows))return {blocked:true,unreadable:true};
  return {blocked:rows.some(row=>!row.confirmedAt),unreadable:false};
 }catch{return {blocked:true,unreadable:true};}
}
