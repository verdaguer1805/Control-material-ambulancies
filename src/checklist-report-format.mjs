// Use the actual worksheet range so new report columns also receive the status color.
export function colorChecklistReportRows(XLSX, sheet, rows) {
  if (!sheet['!ref']) return;
  const range = XLSX.utils.decode_range(sheet['!ref']);
  rows.forEach((row, index) => {
    const rgb = row.Estado === 'Correcto' ? 'D9EEDC' : ['Con incidencia','Incidencia'].includes(row.Estado) ? 'F8CDCD' : 'FFFFFF';
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const cell = sheet[XLSX.utils.encode_cell({r:range.s.r + index + 1,c:column})];
      if (cell) cell.s = {...cell.s,fill:{fgColor:{rgb}}};
    }
  });
}

// Real submissions stay first; missing reviews remain white at the bottom.
export function checklistReportOrder(a,b) {
  return Number(!a.submitted_at)-Number(!b.submitted_at)
    || String(a.report_date || a.guard_started_at || '').slice(0,10).localeCompare(String(b.report_date || b.guard_started_at || '').slice(0,10))
    || String(a.unit).localeCompare(String(b.unit),'es',{numeric:true})
    || String(a.guard_started_at || '').localeCompare(String(b.guard_started_at || ''));
}

export function withMissingChecklists(records,units,from,to,now=new Date()) {
  const dates=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'});
  const result=[...records],today=dates.format(now);
  const present=new Set(records.map(record=>`${record.unit}:${record.report_date || dates.format(new Date(record.guard_started_at))}`));
  const latest=to<today?to:today;
  for(let date=from;date<=latest;){
    for(const entry of units) {
      const unit=typeof entry==='string'?entry:entry.unit;
      if(typeof entry==='object' && entry.first_date && date<entry.first_date) continue;
      const key=`${unit}:${date}`;
      if(!present.has(key)) {
        result.push({unit,report_date:date,submitted_at:null,answers:{}});
        present.add(key);
      }
    }
    const next=new Date(`${date}T12:00:00Z`);next.setUTCDate(next.getUTCDate()+1);date=next.toISOString().slice(0,10);
  }
  return result.sort(checklistReportOrder);
}

export function vehicleAuditReport(XLSX,audits,label=value=>value,dateTime=value=>({date:value,time:''})) {
  const rows=audits.map(audit=>{
    const issues=(audit.items || []).filter(item=>item.status==='issue');
    const when=dateTime(audit.received_at);
    return {Fecha:when.date,Hora:when.time,Supervisor:audit.supervisor,Vehículo:audit.vehicle,Checklist:audit.checklist_type,
      Estado:issues.length?'Con incidencia':'Correcto',Incidencias:issues.length?`Ver incidencias (${issues.length})`:'—'};
  });
  const summary=XLSX.utils.json_to_sheet(rows.length?rows:[{Información:'No hay auditorías en este periodo'}]);
  summary['!cols']=[14,12,32,16,16,20,25].map(wch=>({wch}));
  if(summary['!ref'])summary['!autofilter']={ref:summary['!ref']};
  colorChecklistReportRows(XLSX,summary,rows);
  const details=[];
  audits.forEach((audit,index)=>{
    const issues=(audit.items || []).filter(item=>item.status==='issue');
    if(!issues.length)return;
    const name=`Aud ${index+1} ${String(audit.vehicle).replace(/[\\/?*\[\]:']/g,'').slice(0,16)}`;
    const detailRows=issues.map(item=>({Vehículo:audit.vehicle,Apartado:item.section,Material:label(item.label),Observaciones:item.note || '',Volver:'Volver al resumen'}));
    const sheet=XLSX.utils.json_to_sheet(detailRows);
    sheet['!cols']=[16,38,65,65,25].map(wch=>({wch}));
    sheet['!autofilter']={ref:sheet['!ref']};
    sheet['!rows']=[{hpt:30},...detailRows.map(()=>({hpt:48}))];
    detailRows.forEach((_,r)=>{
      for(let c=0;c<5;c++)sheet[XLSX.utils.encode_cell({r:r+1,c})].s={fill:{fgColor:{rgb:'F8CDCD'}},alignment:{wrapText:true,vertical:'top'}};
      sheet[`E${r+2}`].l={Target:`#'Auditorías vehículos'!A${index+2}`};
      sheet[`E${r+2}`].s.font={color:{rgb:'0563C1'},underline:true};
    });
    summary[`G${index+2}`].l={Target:`#'${name}'!A2`};
    summary[`G${index+2}`].s.font={color:{rgb:'0563C1'},underline:true};
    details.push({name,sheet});
  });
  return {summary,details};
}

export function checklistReportWidths(rows) {
  return Object.keys(rows[0] || {}).map(header =>
    header === 'Incidencias' ? 24 : Math.max(14, header.length + 3));
}

export const INCIDENT_DETAIL_SHEET = 'Incidencias SVB';
const zoneNames = {left:'Zona izquierda',front:'Zona frontal',right:'Zona derecha',cabin:'Cabina de conducción',door:'Puerta corredera izquierda'};

export function checklistIncidentDetails(records, label = value => value) {
  return records.flatMap((record, recordIndex) =>
    Object.entries(record.answers || {}).flatMap(([zone, sections]) =>
      Object.entries(sections || {}).flatMap(([section, items]) =>
        Object.entries(items || {}).filter(([,value]) => value === 'issue').map(([item]) => ({
          recordIndex, zone:zoneNames[zone] || zone, section, material:label(item)
        }))
      )
    ).sort((a,b) => a.zone.localeCompare(b.zone,'es') || String(a.section).localeCompare(String(b.section),'es',{numeric:true}) || a.material.localeCompare(b.material,'es',{numeric:true}))
  );
}

export function addChecklistIncidentDetails(XLSX, summarySheet, summaryRows, records, label) {
  const details=checklistIncidentDetails(records,label);
  const grouped=new Map();
  details.forEach(detail=>{
    if(!grouped.has(detail.recordIndex))grouped.set(detail.recordIndex,[]);
    grouped.get(detail.recordIndex).push(detail);
  });
  return [...grouped].map(([recordIndex,items])=>{
    // The row number guarantees unique, Excel-safe names even for repeated units/dates.
    const unit=String(summaryRows[recordIndex].Unidad || 'Unidad').replace(/[\\/?*\[\]:']/g,'').slice(0,16);
    const name=`Inc ${recordIndex+1} ${unit}`.slice(0,31);
    return {name,sheet:incidentDetailSheet(XLSX,summarySheet,summaryRows,items,name)};
  });
}

function incidentDetailSheet(XLSX, summarySheet, summaryRows, details, name) {
  const rows=details.map(detail => {
    const summary=summaryRows[detail.recordIndex];
    return {
      Fecha:summary.Fecha, Unidad:summary.Unidad, Vehículo:summary.Vehículo,
      'Inicio de guardia':summary['Inicio de guardia'],
      'Fecha de envío':summary['Fecha de envío'], 'Hora de checklist':summary['Hora de checklist'],
      Zona:detail.zone, Compartimento:detail.section, Material:detail.material,
      Volver:'Volver al checklist'
    };
  });
  const sheet=XLSX.utils.json_to_sheet(rows);
  sheet['!cols']=[14,14,14,19,18,19,29,19,65,24].map(wch=>({wch}));
  sheet['!autofilter']={ref:sheet['!ref']};
  sheet['!rows']=[{hpt:32},...rows.map(()=>({hpt:48}))];
  const linkStyle={color:{rgb:'0563C1'},underline:true};
  rows.forEach((row,index) => {
    for(let c=0;c<Object.keys(row).length;c++) {
      const cell=sheet[XLSX.utils.encode_cell({r:index+1,c})];
      if(cell)cell.s={fill:{fgColor:{rgb:'F8CDCD'}},alignment:{vertical:'top',wrapText:true}};
    }
    const back=sheet[XLSX.utils.encode_cell({r:index+1,c:9})];
    back.l={Target:`#'Checklist SVB'!A${details[index].recordIndex+2}`};
    back.s={...back.s,font:linkStyle};
  });
  Object.keys(rows[0]).forEach((_,c)=>{
    sheet[XLSX.utils.encode_cell({r:0,c})].s={font:{bold:true,color:{rgb:'FFFFFF'}},fill:{fgColor:{rgb:'C8102E'}},alignment:{wrapText:true}};
  });
  const firstRows=new Map();
  details.forEach((detail,index)=>{if(!firstRows.has(detail.recordIndex))firstRows.set(detail.recordIndex,index+2);});
  firstRows.forEach((target,recordIndex)=>{
    const column=Object.keys(summaryRows[recordIndex]).indexOf('Incidencias');
    const cell=summarySheet[XLSX.utils.encode_cell({r:recordIndex+1,c:column})];
    const count=details.filter(detail=>detail.recordIndex===recordIndex).length;
    cell.v=`Ver incidencias (${count})`;
    cell.l={Target:`#'${name}'!A${target}`,Tooltip:'Ver solo las incidencias de este checklist'};
    cell.s={...cell.s,font:linkStyle};
  });
  return sheet;
}
