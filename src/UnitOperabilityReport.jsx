import React,{useState} from 'react';
import {supabase,ensureAnonymousSession} from './supabase.js';
import {saveAs} from 'file-saver';
import {madridDateTime} from './report-datetime.mjs';
import {inoperabilityReportRows,madridDayStart} from './unit-operability-report.mjs';
import {canReadAdminReports} from './admin-report-access.mjs';
export default function UnitOperabilityReport({access,lots,transport,open:controlledOpen,onClose}){
  const [internalOpen,setInternalOpen]=useState(false),[lot,setLot]=useState(''),[zone,setZone]=useState(access?.zone||''),[from,setFrom]=useState(()=>madridDateTime(new Date()).date),[to,setTo]=useState(()=>madridDateTime(new Date()).date),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const controlled=typeof controlledOpen==='boolean',open=controlled?controlledOpen:internalOpen;
  const close=()=>controlled?onClose?.():setInternalOpen(false);
  if(!canReadAdminReports(access))return null;
  const zones=Object.keys(lots[lot]||{}).filter(value=>access.role!=='supervisor'||access.zone===value);
  async function download(){
    setBusy(true);setMessage('');
    try{
      if(!lot||!zones.includes(zone)||from>to)throw new Error('Selecciona lote, zona y un período válido.');
      const args={p_lot:lot,p_zone:zone,p_from:madridDayStart(from),p_to:madridDayStart(to,1)};
      const records=[];
      for(let offset=0;;offset+=1000){
        let data;
        if(transport)data=await transport('get_unit_inoperability_report',{...args,p_offset:offset});
        else{await ensureAnonymousSession();const result=await supabase.rpc('get_unit_inoperability_report',{...args,p_offset:offset});if(result.error)throw result.error;data=result.data;}
        if(!Array.isArray(data))throw new Error('No se ha podido validar la respuesta del informe.');
        records.push(...data);if(data.length<1000)break;
      }
      if(!records.length)throw new Error('No hay inoperatividades registradas en este período y zona.');
      const rows=inoperabilityReportRows([...new Map(records.map(row=>[row.id,row])).values()]);
      const XLSX=await import('xlsx-js-style');
      const sheet=XLSX.utils.json_to_sheet(rows),book=XLSX.utils.book_new();
      sheet['!cols']=[12,16,23,23,38,25,20,20,48,48,28,48,23,23].map(wch=>({wch}));
      sheet['!autofilter']={ref:sheet['!ref']};
      for(const [key,cell] of Object.entries(sheet))if(!key.startsWith('!'))cell.s={alignment:{vertical:'top',wrapText:true},...(key.match(/\d+$/)?.[0]==='1'?{font:{bold:true,color:{rgb:'FFFFFF'}},fill:{fgColor:{rgb:'006477'}}}:{})};
      XLSX.utils.book_append_sheet(book,sheet,'Inoperatividades');
      saveAs(new Blob([XLSX.write(book,{bookType:'xlsx',type:'array'})],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),`inoperatividades_${from}_${to}.xlsx`);
      setMessage(`Informe preparado: ${rows.length} registros.`);
    }catch(error){setMessage(/PGRST202|does not exist/.test(String(error?.message||''))?'Los informes de inoperatividad todavía no están activados en el servidor.':error.message||'No se ha podido obtener el informe.');}
    finally{setBusy(false);}
  }
  if(controlled&&!open)return null;
  const content=<>
    <h2>Informe de inoperatividades</h2><p>Unidad, vehículo y matrícula conservados tal como eran en cada comunicación.</p>
    <label>Lote<select value={lot} disabled={busy} onChange={e=>{setLot(e.target.value);setZone(access.role==='supervisor'?access.zone:'');}}><option value="">Selecciona...</option>{Object.keys(lots).map(value=><option key={value}>{value}</option>)}</select></label>
    <label>Zona<select value={zone} disabled={busy} onChange={e=>setZone(e.target.value)}><option value="">Selecciona...</option>{zones.map(value=><option key={value}>{value}</option>)}</select></label>
    <label>Desde<input type="date" value={from} disabled={busy} onChange={e=>setFrom(e.target.value)}/></label><label>Hasta<input type="date" value={to} disabled={busy} onChange={e=>setTo(e.target.value)}/></label>
    <button className="primary" onClick={download} disabled={busy}>{busy?'Preparando...':'Descargar informe de inoperatividades'}</button>{message&&<p role="status">{message}</p>}
  </>;
  return controlled?<div className="modal-backdrop"><section className="card export-modal inoperability-report-modal" role="dialog" aria-modal="true" aria-label="Informe de inoperatividades">{content}<button className="secondary full" onClick={close} style={{marginTop:12}}>Cerrar</button></section></div>:<section className="card"><button className="secondary" onClick={()=>setInternalOpen(!open)}>{open?'Cerrar inoperatividades':'Inoperatividades · Informe'}</button>{open&&content}</section>;
}
