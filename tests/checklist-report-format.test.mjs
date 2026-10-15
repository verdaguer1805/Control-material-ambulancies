import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {colorChecklistReportRows,checklistReportWidths,checklistIncidentDetails,addChecklistIncidentDetails,withMissingChecklists,vehicleAuditReport} from '../src/checklist-report-format.mjs';
import XLSX from 'xlsx-js-style';

test('missing units appear white below submitted checklists, including units with no history',()=>{
 const actual=[{unit:'G450',guard_started_at:'2026-10-15T05:00:00Z',submitted_at:'2026-10-15T06:00:00Z',answers:{}}];
 const result=withMissingChecklists(actual,[{unit:'G450'},{unit:'G440'},{unit:'G449'}],'2026-10-15','2026-10-16',new Date('2026-10-15T12:00:00Z'));
 assert.deepEqual(result.map(row=>row.unit),['G450','G440','G449']);
 assert.ok(result.slice(1).every(row=>!row.submitted_at&&row.report_date==='2026-10-15'));
 const rows=[{Estado:'Correcto'},{Estado:'Con incidencia'},{Estado:'No realizado'}];
 const sheet=XLSX.utils.json_to_sheet(rows);colorChecklistReportRows(XLSX,sheet,rows);
 assert.deepEqual([sheet.A2,sheet.A3,sheet.A4].map(cell=>cell.s.fill.fgColor.rgb),['D9EEDC','F8CDCD','FFFFFF']);
 assert.equal(actual.length,1);
});

test('audit report has one compact row per audit and separate linked incident sheets',()=>{
 const audits=[{vehicle:'5439',supervisor:'Supervisor Olot',received_at:'2026-10-15',checklist_type:'SVB',items:[{section:'Frontal 2',label:'Gasas',status:'issue',note:'Faltan dos'},{section:'Frontal 3',label:'Filtro',status:'ok'}]},
 {vehicle:'5439',supervisor:'Supervisor Olot',received_at:'2026-10-15',checklist_type:'SVB',items:[{section:'Cabina',label:'Casco',status:'issue'}]},
 {vehicle:'5517',supervisor:'Supervisor Girona',received_at:'2026-10-15',checklist_type:'TSNU',items:[{section:'Cabina',label:'Casco',status:'ok'}]}];
 const {summary,details}=vehicleAuditReport(XLSX,audits);
 const rows=XLSX.utils.sheet_to_json(summary);
 assert.equal(rows.length,3);assert.equal(Object.keys(rows[0]).length,7);
 assert.equal(summary.F2.s.fill.fgColor.rgb,'F8CDCD');assert.equal(summary.F4.s.fill.fgColor.rgb,'D9EEDC');
 assert.equal(details.length,2);assert.notEqual(details[0].name,details[1].name);
 assert.deepEqual(details.map(({sheet})=>XLSX.utils.sheet_to_json(sheet).map(row=>row.Material)),[['Gasas'],['Casco']]);
 const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,summary,'Auditorías vehículos');
 details.forEach(({sheet,name})=>XLSX.utils.book_append_sheet(book,sheet,name));
 const saved=XLSX.read(XLSX.write(book,{bookType:'xlsx',type:'buffer'}),{type:'buffer'});
 assert.equal(saved.Sheets['Auditorías vehículos'].G2.l.Target,`#'${details[0].name}'!A2`);
 assert.equal(saved.Sheets[details[1].name].E2.l.Target,"#'Auditorías vehículos'!A3");
});

test('every actual report column is colored including cabin, sliding door and future zones',()=>{
 const XLSX={utils:{decode_range:()=>({s:{r:0,c:0},e:{r:2,c:14}}),encode_cell:({r,c})=>`${r}:${c}`}};
 const sheet={'!ref':'A1:O3'};
 for(let r=0;r<3;r++)for(let c=0;c<15;c++)sheet[`${r}:${c}`]={v:'unchanged',s:{font:{bold:true}}};
 colorChecklistReportRows(XLSX,sheet,[{Estado:'Correcto'},{Estado:'Con incidencia'}]);
 for(let c=0;c<15;c++){
  assert.equal(sheet[`1:${c}`].s.fill.fgColor.rgb,'D9EEDC');
  assert.equal(sheet[`2:${c}`].s.fill.fgColor.rgb,'F8CDCD');
  assert.equal(sheet[`1:${c}`].v,'unchanged');
  assert.equal(sheet[`1:${c}`].s.font.bold,true);
  assert.equal(sheet[`0:${c}`].s.fill,undefined);
 }
});

test('checklist column widths follow headers including new zones',()=>{
 const row={Fecha:'',Unidad:'','Cabina de conducción':'','Puerta corredera izquierda':'',Incidencias:'','Nueva zona de ejemplo':''};
 const widths=checklistReportWidths([row]);
 assert.equal(widths.length,Object.keys(row).length);
 assert.equal(widths[3],'Puerta corredera izquierda'.length+3);
 assert.equal(widths[4],24);
 assert.equal(widths[5],'Nueva zona de ejemplo'.length+3);
 assert.deepEqual(checklistReportWidths([]),[]);
});

test('incident links open the matching checklist detail and survive Excel serialization',()=>{
 const records=[
  {answers:{right:{'2a':{'Guantes M':'issue','Guantes S':'ok'},2:{'Guantes L':'issue'}},cabin:{general:{'Baliza':'issue'}}}},
  {answers:{door:{4:{'Silla':'issue'}}}},
  {answers:{front:{1:{'Filtro':'ok'}}}}
 ];
 const rows=records.map((_,i)=>({Fecha:'11/10/2026',Unidad:`G${450+i}`,Vehículo:`54${39+i}`,'Inicio de guardia':'07:00','Fecha de envío':'11/10/2026','Hora de checklist':'08:15',Estado:i<2?'Con incidencia':'Correcto',Incidencias:i<2?'original detail':'—'}));
 const original=JSON.stringify(records);
 const summary=XLSX.utils.json_to_sheet(rows);
 colorChecklistReportRows(XLSX,summary,rows);
 const details=addChecklistIncidentDetails(XLSX,summary,rows,records,value=>value);
 const detail=details[0].sheet;
 assert.equal(JSON.stringify(records),original);
 assert.equal(checklistIncidentDetails(records).length,4);
 const cells=XLSX.utils.sheet_to_json(detail);
 assert.deepEqual(cells.map(row=>row.Unidad),['G450','G450','G450']);
 assert.deepEqual(cells.filter(row=>row.Zona==='Zona derecha').map(row=>row.Compartimento),['2','2a']);
 assert.equal(XLSX.utils.sheet_to_json(details[1].sheet)[0].Zona,'Puerta corredera izquierda');
 assert.equal(summary.H2.v,'Ver incidencias (3)');
 assert.equal(summary.H2.l.Target,"#'Inc 1 G450'!A2");
 assert.equal(summary.H3.l.Target,"#'Inc 2 G451'!A2");
 assert.equal(summary.H4.l,undefined);
 assert.equal(details[1].sheet.J2.l.Target,"#'Checklist SVB'!A3");
 assert.equal(summary.H2.s.fill.fgColor.rgb,'F8CDCD');
 const wb=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb,summary,'Checklist SVB');
 details.forEach(({sheet,name})=>XLSX.utils.book_append_sheet(wb,sheet,name));
 const saved=XLSX.read(XLSX.write(wb,{bookType:'xlsx',type:'buffer'}),{type:'buffer',cellStyles:true});
 assert.equal(saved.Sheets['Checklist SVB'].H3.l.Target,"#'Inc 2 G451'!A2");
 assert.equal(saved.Sheets['Inc 2 G451'].J2.l.Target,"#'Checklist SVB'!A3");
 assert.equal(saved.Sheets['Inc 1 G450']['!autofilter'].ref,'A1:J4');
 assert.deepEqual(XLSX.utils.sheet_to_json(saved.Sheets['Inc 2 G451']).map(row=>row.Unidad),['G451']);
});

test('no incidence creates no links or empty detail sheet',()=>{
 assert.deepEqual(addChecklistIncidentDetails(XLSX,{},[],[],value=>value),[]);
});

test('repeated units on different dates have isolated, uniquely named detail sheets',()=>{
 const rows=['12/10/2026','13/10/2026'].map(Fecha=>({Fecha,Unidad:'G450',Incidencias:'issue'}));
 const records=['Guantes','Gasas'].map(item=>({answers:{left:{7:{[item]:'issue'}}}}));
 const summary=XLSX.utils.json_to_sheet(rows);
 const details=addChecklistIncidentDetails(XLSX,summary,rows,records);
 assert.notEqual(details[0].name,details[1].name);
 assert.deepEqual(details.map(({sheet})=>XLSX.utils.sheet_to_json(sheet).map(row=>row.Material)),[['Guantes'],['Gasas']]);
 assert.equal(summary.C3.l.Target,`#'${details[1].name}'!A2`);
});

test('both TSU and TSNU exports use the shared dynamic formatting',()=>{
 const source=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
 for(const [sheet,rows] of [['wsChecklistTsu','checklistTsuRows'],['wsChecklistTsnu','checklistTsnuRows']]){
  assert.ok(source.includes(`colorChecklistReportRows(XLSX, ${sheet}, ${rows})`));
  assert.ok(source.includes(`configure(${sheet}, checklistReportWidths(${rows}))`));
 }
});
