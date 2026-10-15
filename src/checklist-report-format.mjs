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
  const rows=[['Fecha','Hora','Supervisor','Vehículo','Checklist','Estado','Incidencias']];
  const rowOptions=[{hpt:28}],merges=[],summaryIndexes=new Set();
  audits.forEach(audit=>{
    const issues=(audit.items || []).filter(item=>item.status==='issue');
    const when=dateTime(audit.received_at),index=rows.length;
    summaryIndexes.add(index);
    rows.push([when.date,when.time,audit.supervisor,audit.vehicle,audit.checklist_type,
      issues.length?'Con incidencia':'Correcto',issues.length?`+ Desplegar (${issues.length})`:'—']);
    rowOptions.push({hpt:32});
    issues.forEach(item=>{
      const r=rows.length;
      rows.push(['Incidencia',`Apartado: ${item.section}`,'',`Material: ${label(item.label)}`,'',item.note?`Observaciones: ${item.note}`:'','']);
      rowOptions.push({hpt:64,hidden:true,level:1});
      merges.push({s:{r,c:1},e:{r,c:2}},{s:{r,c:3},e:{r,c:4}},{s:{r,c:5},e:{r,c:6}});
    });
  });
  if(!audits.length)rows.push(['No hay auditorías en este periodo']);
  const summary=XLSX.utils.aoa_to_sheet(rows);
  summary['!cols']=[14,12,32,16,16,20,25].map(wch=>({wch}));
  summary['!rows']=rowOptions;
  summary['!merges']=merges;
  summary['!outline']={above:true};
  rows.forEach((row,r)=>{
    for(let c=0;c<7;c++) {
      const cell=summary[XLSX.utils.encode_cell({r,c})];
      if(!cell)continue;
      cell.s={alignment:{wrapText:true,vertical:'top'},fill:{fgColor:{rgb:r===0?'C8102E':summaryIndexes.has(r)&&row[5]==='Correcto'?'D9EEDC':'F8CDCD'}}};
      if(r===0)cell.s.font={bold:true,color:{rgb:'FFFFFF'}};
    }
  });
  // Excel expands each row group with its native + control. Hyperlinks cannot
  // unhide worksheets or expand outline groups without macros.
  summaryIndexes.forEach(r=>{
    if(rows[r][6]==='—')return;
    summary[`G${r+1}`].c=[{a:'Control de material',t:'Pulsa el signo + del margen izquierdo de esta fila para desplegar solo sus incidencias. Pulsa − para volver a plegarlas.'}];
  });
  return {summary,details:[]};
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
  if(!summaryRows.length)return [];
  const headers=Object.keys(summaryRows[0]),rows=[headers],options=[{hpt:30}],merges=[],summaryIndexes=new Set();
  const incidentColumn=headers.indexOf('Incidencias');
  const stateColumn=headers.indexOf('Estado');
  summaryRows.forEach((row,index)=>{
    const r=rows.length,items=grouped.get(index) || [];
    summaryIndexes.add(r);
    const values=headers.map(header=>row[header]);
    if(items.length)values[incidentColumn]=`+ Desplegar (${items.length})`;
    rows.push(values);options.push({hpt:36});
    items.forEach(item=>{
      const detailRow=rows.length,values=Array(headers.length).fill('');
      values[0]='Incidencia';values[1]=`${item.zone} · Compartimento ${item.section}`;values[4]=item.material;
      rows.push(values);options.push({hpt:48,hidden:true,level:1});
      merges.push({s:{r:detailRow,c:1},e:{r:detailRow,c:3}},{s:{r:detailRow,c:4},e:{r:detailRow,c:headers.length-1}});
    });
  });
  const sheet=XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols']=summarySheet['!cols'];sheet['!rows']=options;sheet['!merges']=merges;sheet['!outline']={above:true};
  rows.forEach((row,r)=>{
    const rgb=r===0?'C8102E':!summaryIndexes.has(r)||row[stateColumn]==='Con incidencia'?'F8CDCD':row[stateColumn]==='Correcto'?'D9EEDC':'FFFFFF';
    row.forEach((_,c)=>{
      const cell=sheet[XLSX.utils.encode_cell({r,c})];if(!cell)return;
      cell.s={alignment:{wrapText:true,vertical:'top'},fill:{fgColor:{rgb}}};
      if(r===0)cell.s.font={bold:true,color:{rgb:'FFFFFF'}};
    });
    if(summaryIndexes.has(r)&&String(row[incidentColumn]).startsWith('+'))
      sheet[XLSX.utils.encode_cell({r,c:incidentColumn})].c=[{a:'Control de material',t:'Pulsa el signo + del margen izquierdo para desplegar solo las incidencias de este checklist. Pulsa − para plegarlas.'}];
  });
  Object.keys(summarySheet).forEach(key=>delete summarySheet[key]);
  Object.assign(summarySheet,sheet);
  return [];
}
