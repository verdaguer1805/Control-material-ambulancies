import React, {useState} from 'react';
import VehicleAuditMap from './VehicleAuditMap.jsx';
import { tsnuChecklistLabel } from './tsnu-checklist-catalog.mjs';
import {auditorError} from './auditor-client.mjs';
import {AUDIT_TYPES, auditItems, auditComplete, auditRequest, isAuditSupervisor, markAuditGroupCorrect, normalizeAuditVehicle, readAudits, refreshPendingAudit, saveAudit, validAuditVehicle} from './vehicle-audit.mjs';

export default function VehicleAudit({supervisor, lot, zone, authorized, preview=false, auditorService=null,storageOverride=null}) {
  const storage=storageOverride||(preview ? sessionStorage : localStorage);
  const [open,setOpen]=useState(preview), [vehicle,setVehicle]=useState(''), [type,setType]=useState(''), [draft,setDraft]=useState(null), [notice,setNotice]=useState(''), [busy,setBusy]=useState(false);
  if (!isAuditSupervisor(supervisor) && !auditorService) return null;
  const scope = row => row.supervisor===supervisor && row.lot===lot && row.zone===zone;
  async function begin() {
    if(!authorized||busy)return;
    setBusy(true);
    try {
      if (!validAuditVehicle(vehicle)) throw new Error('Introduce el identificador del vehículo, por ejemplo T1733 o 5438.');
      const catalog=auditItems(type,vehicle);
      if (!catalog.length) throw new Error('Contenido pendiente para este tipo de checklist.');
      const next={id:crypto.randomUUID(), supervisor,lot,zone,vehicle:normalizeAuditVehicle(vehicle),type,startedAt:new Date().toISOString(),catalog,answers:{},notes:{},confirmedAt:null};
      if(auditorService)await auditorService.begin(next);
      saveAudit(storage,next);setDraft(next);setNotice('');
    } catch(error) {setNotice(auditorService?auditorError(error):error.message);}finally{setBusy(false);}
  }
  function update(next) {if(!authorized)return;try {next={...next,editVersion:Math.max(Date.now()*1000,(draft?.editVersion||0)+1)};saveAudit(storage,next);setDraft(next);setNotice('');if(auditorService&&!next.confirmedAt)void auditorService.save(next).catch(error=>setNotice(auditorError(error)));}catch(error){setNotice(error.message);}}
  async function resume() {if(!authorized)return;try {const remote=auditorService?await auditorService.pending():[];const local=readAudits(storage).filter(scope).filter(row=>!row.confirmedAt);const saved=remote.length?remote.at(-1):local.at(-1);if(!saved)throw new Error('No hay una auditoría pendiente.');const moreRecent=local.find(row=>row.id===saved.id&&row.editVersion>saved.editVersion);const next=auditorService?(moreRecent||saved):refreshPendingAudit(saved);saveAudit(storage,next);setDraft(next);setOpen(true);setNotice('');}catch(error){setNotice(error.message);}}
  async function submit() {
    if(busy || !authorized)return;
    if(preview){const next={...draft,confirmedAt:new Date().toISOString()};update(next);setNotice('Simulación completada. No se ha enviado ningún dato.');return;}
    setBusy(true);setNotice('Enviando auditoría...');
    try {
      let data;
      if(auditorService){auditRequest(draft);data=await auditorService.submit(draft);}
      else{const {supabase}=await import('./supabase');const result=await supabase.rpc('submit_vehicle_audit',auditRequest(draft));if(result.error)throw result.error;data=result.data;}
      const next={...draft,confirmedAt:data.received_at};saveAudit(storage,next);setDraft(next);
      setNotice(`Auditoría enviada correctamente · ${new Date(data.received_at).toLocaleString('es-ES',{timeZone:'Europe/Madrid'})}`);
    }catch(error){setNotice(auditorService?auditorError(error):/SUPERVISOR_NOT_AUTHORIZED/.test(error.message)?'Este dispositivo no tiene autorización de supervisor.':/PGRST202|42883/.test(`${error.code} ${error.message}`)?'La función de auditoría aún no está activada. El borrador sigue guardado.':'No se ha podido enviar la auditoría. El borrador sigue guardado; vuelve a intentarlo.');}
    finally {setBusy(false);}
  }
  const groups=draft ? [...new Set(draft.catalog.map(item=>item.section))] : [];
  return <section className="card">
    <h2>Auditoría de vehículos</h2>
    <p className="small">Revisión independiente. No sustituye el checklist de los técnicos ni modifica el stock. El material retirado se envía por separado.</p>
    {!open ? <><button className="primary full" disabled={!authorized} onClick={()=>{setOpen(true);setDraft(null);setNotice('');}}>Auditar vehículo</button><button className="secondary full" style={{marginTop:8}} disabled={!authorized} onClick={resume}>Continuar auditoría pendiente</button></> : <>
      {type==='TSNU'&&!draft&&vehicle&&<p>Checklist TSNU · {tsnuChecklistLabel(vehicle)} · Detectado automáticamente</p>}
      {!draft ? <><label>Vehículo<input value={vehicle} maxLength={20} placeholder="T1733, 5517, 5438…" onChange={e=>setVehicle(e.target.value)}/></label><label>Tipo de checklist<select value={type} onChange={e=>setType(e.target.value)}><option value="">Selecciona checklist</option>{AUDIT_TYPES.map(t=><option key={t}>{t}</option>)}</select></label>{['Polivalente','Logística'].includes(type)&&<p>Contenido pendiente. Todavía no se puede realizar esta auditoría.</p>}<button className="primary full" disabled={!authorized || !auditItems(type).length} onClick={begin}>Comenzar auditoría</button></> : <>
        <h3>Vehículo {draft.vehicle} · {draft.type}</h3><p>{draft.supervisor} · {draft.zone}</p>
        {draft.type==='SVB'?<VehicleAuditMap key={draft.id} draft={draft} update={update} busy={busy||!authorized}/>:groups.map(title=>{const items=draft.catalog.filter(item=>item.section===title);const groupId=items[0].id.slice(0,items[0].id.lastIndexOf(':'));return <details key={title} style={{margin:'12px 0',padding:12,border:'1px solid #aab8bc',borderRadius:10}}><summary>{title} · {items.filter(item=>draft.answers[item.id]).length}/{items.length}</summary><button className="secondary" disabled={busy||!authorized||!!draft.confirmedAt} onClick={()=>update(markAuditGroupCorrect(draft,groupId))}>Marcar todo correcto</button>{items.map(item=><div key={item.id} style={{marginTop:12}}><label>{item.label}<select aria-label={item.label} value={draft.answers[item.id]||''} disabled={busy||!authorized||!!draft.confirmedAt} onChange={e=>update({...draft,answers:{...draft.answers,[item.id]:e.target.value},confirmedAt:null})}><option value="">Pendiente</option><option value="ok">Correcto</option><option value="issue">Incidencia</option></select></label>{draft.answers[item.id]==='issue'&&<input aria-label={`Observaciones: ${item.label}`} placeholder="Observaciones de la incidencia" maxLength={1000} disabled={busy||!authorized||!!draft.confirmedAt} value={draft.notes[item.id]||''} onChange={e=>update({...draft,notes:{...draft.notes,[item.id]:e.target.value},confirmedAt:null})}/>}</div>)}</details>})}
        <button className="primary full" disabled={busy||!authorized||!auditComplete(draft)||!!draft.confirmedAt} onClick={submit}>{draft.confirmedAt?'Auditoría enviada':'Finalizar y enviar auditoría'}</button>
        {draft.confirmedAt&&<button className="secondary full" onClick={()=>{setDraft(null);setVehicle('');setType('');setNotice('');}}>Auditar otro vehículo</button>}
      </>}
      <button className="secondary full" style={{marginTop:8}} disabled={busy} onClick={()=>setOpen(false)}>Cerrar</button>
    </>}
    {notice&&<p role="status">{notice}</p>}
  </section>;
}
