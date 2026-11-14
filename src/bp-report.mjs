import {withMissingChecklists} from './checklist-report-format.mjs';
export function bpReportSheet(XLSX,records,roster,from,to,dateTime){
 const data=withMissingChecklists(records,roster,from,to);
 const rows=[['Fecha guardia','Unidad','Vehículo','Fecha envío','Hora envío','Estado','Incidencias']],options=[{hpt:28}],summaryRows=[];
 for(const r of data){
  const issues=(r.items||[]).filter(i=>i.status==='issue');
  const date=r.report_date||dateTime(r.guard_started_at).date,when=r.submitted_at?dateTime(r.submitted_at):{};
  summaryRows.push(rows.length);
  rows.push([date,r.unit,r.vehicle_label||'',when.date||'',when.time||'',!r.submitted_at?'No realizado':issues.length?'Con incidencia':'Correcto',issues.length?`+ Desplegar (${issues.length})`:'—']);
  options.push({hpt:32});
  for(const i of issues){rows.push(['Incidencia',i.section,i.label,'','',i.note||'','']);options.push({hpt:64,hidden:true,level:1});}
 }
 const sheet=XLSX.utils.aoa_to_sheet(rows);sheet['!cols']=[16,14,14,16,14,22,26].map(wch=>({wch}));sheet['!rows']=options;sheet['!outline']={above:true};
 for(let r=0;r<rows.length;r++)for(let c=0;c<7;c++){const cell=sheet[XLSX.utils.encode_cell({r,c})];if(!cell)continue;
  cell.s={alignment:{wrapText:true,vertical:'top'},fill:{fgColor:{rgb:r===0?'C8102E':summaryRows.includes(r)?rows[r][5]==='Correcto'?'D9EEDC':rows[r][5]==='No realizado'?'FFFFFF':'F8CDCD':'F8CDCD'}}};
  if(r===0)cell.s.font={bold:true,color:{rgb:'FFFFFF'}};
 }
 return sheet;
}
