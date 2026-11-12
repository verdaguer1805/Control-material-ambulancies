export const REPORTS_VIEWER_ROLE='reports_viewer';
export const isReportsOnlyAccess=access=>access?.role===REPORTS_VIEWER_ROLE;
export const canReadAllReportZones=access=>['owner','logistics',REPORTS_VIEWER_ROLE].includes(access?.role);
export const canReadAdminReports=access=>['owner','logistics','supervisor',REPORTS_VIEWER_ROLE].includes(access?.role);
export const canCorrectConsumption=access=>['owner','supervisor'].includes(access?.role);
export const canReadSystemStatus=access=>access?.role==='owner';
export const canReadInoperability=access=>['owner','supervisor',REPORTS_VIEWER_ROLE].includes(access?.role);
export function adminAccessLabel(access){
  if(access?.role==='owner' && access?.display_name==='Zoraida')return 'Zoraida';
  return isReportsOnlyAccess(access)?'SOTS-CAP PICORNELL':access?.role==='owner'?'Propietario':access?.role==='logistics'?'Logística':`Supervisión ${access?.zone||''}`;
}
