// Use the actual worksheet range so new report columns also receive the status color.
export function colorChecklistReportRows(XLSX, sheet, rows) {
  if (!sheet['!ref']) return;
  const range = XLSX.utils.decode_range(sheet['!ref']);
  rows.forEach((row, index) => {
    const rgb = row.Estado === 'Correcto' ? 'D9EEDC' : 'F8CDCD';
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const cell = sheet[XLSX.utils.encode_cell({r:range.s.r + index + 1,c:column})];
      if (cell) cell.s = {...cell.s,fill:{fgColor:{rgb}}};
    }
  });
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
