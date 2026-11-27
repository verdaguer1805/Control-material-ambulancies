import React,{useEffect,useRef,useState} from 'react';
import BpChecklistMap from './BpChecklistMap.jsx';
import {BP_ITEMS,bpDraftKey,bpPayload,bpSnapshot,bpStatus} from './bp-operational.mjs';
import {svbAssignedGuard} from './svb-guard-window.mjs';
import {readSvbVehicleAssignment,writeSvbVehicleAssignment} from './svb-vehicle-assignment.mjs';
import {supabase} from './supabase';
import {showChecklistSendReminder} from '../public/checklists/checklist-send-reminder.js';
import {withRequestDeadline,REQUEST_TIMEOUT_MESSAGE} from '../public/checklists/request-deadline.js';
import ChecklistPendingNotice from './ChecklistPendingNotice.jsx';
import {readChecklistPending,beginChecklistAttempt,failChecklistAttempt,confirmChecklistAttempt,checklistPendingText,checklistPendingLabel,showChecklistPendingDialog} from '../public/checklists/checklist-pending.js';
export default function BpUnitChecklist({unit,lot,zone,shift,authorized}){
 const [open,setOpen]=useState(false),[vehicle,setVehicle]=useState(()=>readSvbVehicleAssignment(localStorage,unit)),[input,setInput]=useState(''),[editing,setEditing]=useState(false);
 const [draft,setDraft]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[tick,setTick]=useState(Date.now());
 const sendLock=useRef(false),prompted=useRef('');
 const [reviewing,setReviewing]=useState(false);
 const guard=svbAssignedGuard(shift,new Date(tick));
 const key=guard&&/^\d{4}$/.test(vehicle)?bpDraftKey({unit,lot,zone,vehicle,guardCode:guard.code}):'';
 useEffect(()=>{const refresh=()=>setTick(Date.now());const timer=setInterval(refresh,15000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};},[]);
 useEffect(()=>{
  prompted.current='';setReviewing(false);setError('');setDraft(null);
  if(!key)return;
  try{const raw=localStorage.getItem(key);const saved=raw?JSON.parse(raw):null;
   if(saved&&(!saved.answers||typeof saved.answers!=='object'||Array.isArray(saved.answers)||bpDraftKey(saved)!==key||saved.guardStartedAt!==guard.start))throw new Error('Borrador no válido');
   setDraft(saved?{...saved,catalog:BP_ITEMS}:{unit,lot,zone,vehicle,guardCode:guard.code,guardStartedAt:guard.start,catalog:BP_ITEMS,answers:{},notes:{}});
  }catch{setError('No se puede leer el borrador guardado. No se ha borrado. Contacta con supervisión.');}
 },[key]);
 function persist(next){try{localStorage.setItem(bpDraftKey(next),JSON.stringify(next));setDraft(next);setError('');return true;}catch{setError('No se ha podido guardar el cambio en este móvil. No cierres la pantalla y contacta con supervisión.');return false;}}
 function update(next){if(!busy&&authorized&&key===bpDraftKey(next))persist(next);}
 async function submit(){
  if(sendLock.current||!draft||!authorized)return;
  const current=svbAssignedGuard(shift);
  if(!current||current.code!==draft.guardCode||current.start!==draft.guardStartedAt){setTick(Date.now());setError('Ha cambiado la guardia. El checklist anterior se conserva; revisa el nuevo turno.');return;}
  const sent=draft;sendLock.current=true;setBusy(true);setError('');
  let attempt;
  try{const payload=bpPayload(sent);attempt=beginChecklistAttempt(localStorage,{...sent,type:'BP'});
   const result=await withRequestDeadline(signal=>supabase.rpc('submit_bp_checklist',payload).abortSignal(signal));if(result.error)throw result.error;
   if(!result.data?.submitted_at)throw new Error('Envío sin confirmación');
   const next={...sent,confirmedAt:result.data.submitted_at,sentSnapshot:bpSnapshot(sent)};
   localStorage.setItem(bpDraftKey(next),JSON.stringify(next));
   confirmChecklistAttempt(localStorage,attempt,result.data.submitted_at);
   const now=svbAssignedGuard(shift);if(now?.code===next.guardCode)setDraft(next);
  }catch(e){try{failChecklistAttempt(localStorage,attempt,e);}catch{}
   const message=!attempt?'No se ha podido guardar el aviso de envío. No cierres la pantalla ni borres los datos; avisa a supervisión.':/CHECKLIST_REQUEST_TIMEOUT/.test(e.message||'')?REQUEST_TIMEOUT_MESSAGE:checklistPendingText(readChecklistPending(localStorage,attempt)||attempt);
   setError(message);showChecklistPendingDialog(message,checklistPendingLabel({...sent,type:'BP'}));}
  finally{sendLock.current=false;setBusy(false);}
 }
 const complete=draft&&bpStatus(draft.answers,BP_ITEMS.map(i=>i.id))!=='pending';
 const snapshot=draft?bpSnapshot(draft):'';const pending=draft&&readChecklistPending(localStorage,{...draft,type:'BP'});const sent=complete&&draft.sentSnapshot===snapshot&&!pending;
 useEffect(()=>{if(!open||reviewing||!complete||busy||sent||pending||!authorized||!draft||key!==bpDraftKey(draft))return;
  if(prompted.current===snapshot)return;prompted.current=snapshot;
  return showChecklistSendReminder(draft.confirmedAt?'updated':'first',submit);
 },[open,reviewing,complete,busy,sent,snapshot,key,authorized]);
 function assign(){const value=input.trim();if(!/^\d{4}$/.test(value)){setError('Introduce las 4 cifras del vehículo.');return;}
  try{if(!writeSvbVehicleAssignment(localStorage,unit,value))throw new Error();setVehicle(value);setEditing(false);}catch{setError('No se ha podido guardar el vehículo.');}}
 return <section className="card"><ChecklistPendingNotice lot={lot} zone={zone} unit={unit} type="BP"/><button type="button" className="primary full" onClick={()=>{setTick(Date.now());setReviewing(false);setOpen(!open);}}> {open?'Cerrar checklist':'Checklist BP · Polivalente'}</button>
 {open&&<><h3>BP · Polivalente</h3><p>Unidad <strong>{unit}</strong> · Vehículo <strong>{vehicle||'Sin asignar'}</strong></p>
 {!vehicle||editing?<div><label>Vehículo<input inputMode="numeric" maxLength={4} value={input} disabled={busy} onChange={e=>setInput(e.target.value)}/></label><button type="button" disabled={busy||!authorized} onClick={assign}>Asignar vehículo</button></div>:<button type="button" className="secondary" disabled={busy} onClick={()=>{setInput(vehicle);setEditing(true);}}>Cambiar vehículo</button>}
 <p>{guard?`Guardia ${guard.code} · ${new Date(guard.start).toLocaleString('es-ES',{timeZone:'Europe/Madrid'})}`:'No hay una guardia disponible. Comprueba el horario asignado.'}</p>
 <button type="button" className="primary full" style={{position:'sticky',top:0,zIndex:5}} disabled={!complete||busy||!authorized||!key||!draft||key!==bpDraftKey(draft)} onClick={submit}>{busy?'Enviando…':sent?'✓ Checklist enviado':draft?.confirmedAt?'Reenviar checklist actualizado':'Finalizar y enviar checklist'}</button>
 <p role="status">{pending?'⚠ Checklist pendiente de confirmar.':sent?'Checklist enviado y confirmado.':complete?'Todas las zonas revisadas. Falta enviar.':'Revisa todos los puntos, incluidos los que tengan incidencias.'}</p>
 {draft&&key===bpDraftKey(draft)&&<BpChecklistMap key={key} draft={draft} update={update} busy={busy||!authorized} onReviewOpenChange={setReviewing}/>}
 </>}{error&&<p role="alert">{error}</p>}</section>;
}
