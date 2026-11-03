import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ensureAnonymousSession,supabase} from './supabase.js';
import {readSvbVehicleAssignment} from './svb-vehicle-assignment.mjs';
import {newOperationId} from './tsnu-outbox.mjs';
import {INOPERABILITY_REASONS,readOperability,saveOperability,operabilityStart,operabilityClose,operabilityRequest,confirmedOperability,operabilityError,operabilityTime} from './unit-operability.mjs';
import {readCachedVehicle,cacheConfirmedVehicle} from './unit-vehicle-cache.mjs';
import './unit-operability.css';

const emptyForm=()=>({vehicle:'',reason:'',hasPatient:'',incidentReference:'',description:'',justification:'',resolution:''});
function projectedIncident(record) {
  let active=record.confirmed?.active||null;
  for(const operation of record.pending||[])active=operation.type==='start'?{id:operation.id,lot:operation.lot,unit:operation.unit,vehicle:operation.vehicle,started_at:operation.at}:null;
  return active;
}
export default function UnitOperability({lot,unit,authorized,service,initialVehicle='',transport,storage=localStorage}) {
  const [record,setRecord]=useState(()=>readOperability(storage,lot,unit)||{lot,unit,confirmed:null,pending:[]});
  const current=useRef(record),lock=useRef(false),sequence=useRef(0);
  const modalRef=useRef(null),vehicleLookup=useRef(0),incidentInputRef=useRef(null);
  const [verified,setVerified]=useState(false),[busy,setBusy]=useState(false),[dialog,setDialog]=useState(''),[form,setForm]=useState(emptyForm),[message,setMessage]=useState(''),[vehicleNote,setVehicleNote]=useState('');
  const [incidentError,setIncidentError]=useState('');
  const pending=record.pending||[],active=projectedIncident(record);
  function commit(next){saveOperability(storage,next);current.current=next;setRecord(next);}
  async function rpc(name,args) {
    if(transport)return transport(name,args);
    let timer;
    try{return await Promise.race([(async()=>{await ensureAnonymousSession();const {data,error}=await supabase.rpc(name,args);if(error)throw error;return data;})(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('OPERABILITY_NETWORK_TIMEOUT')),20000);})]);}
    finally{clearTimeout(timer);}
  }
  async function lookupVehicle(vehicle) {
    const clean=String(vehicle||'').trim().toUpperCase();if(!clean)return null;
    let cached=readCachedVehicle(storage,lot,clean);
    try {
      const row=await rpc('get_my_operability_vehicle',{p_expected_lot:lot,p_expected_unit:unit,p_vehicle:clean});
      cached=cacheConfirmedVehicle(storage,row,lot,clean);
    }catch{/* A previously verified local identity remains usable without coverage. */}
    return cached;
  }
  async function synchronize() {
    if(lock.current)return;
    lock.current=true;sequence.current++;setBusy(true);
    try{
      while(current.current.pending?.length){
        const operation=current.current.pending[0],[name,args]=operabilityRequest(operation);
        const data=await rpc(name,args);
        if(!confirmedOperability(data,lot,unit))throw new Error('OPERABILITY_SCOPE_CHANGED');
        commit({...current.current,confirmed:data,pending:current.current.pending.filter(item=>item.id!==operation.id)});
        setVerified(true);
      }
      setMessage('Comunicación confirmada correctamente.');
    }catch(error){setVerified(false);setMessage(operabilityError(error));}
    finally{lock.current=false;setBusy(false);}
  }
  async function refresh() {
    if(lock.current)return;
    const request=++sequence.current;
    try{
      const data=await rpc('get_my_unit_operability',{p_expected_lot:lot,p_expected_unit:unit});
      if(request!==sequence.current)return;
      if(!confirmedOperability(data,lot,unit))throw new Error('OPERABILITY_SCOPE_CHANGED');
      commit({...current.current,confirmed:data});setVerified(true);
      if(current.current.pending?.length)void synchronize();
    }catch(error){if(request===sequence.current){setVerified(false);if(/PGRST202|does not exist/.test(String(error?.message||'')))setMessage(operabilityError(error));}}
  }
  useEffect(()=>{
    if(!authorized)return;
    void refresh();
    const known=initialVehicle || (service==='TSNU'?unit:readSvbVehicleAssignment(storage,unit));
    if(known)void lookupVehicle(known);
    const visible=()=>{if(!document.hidden)void refresh();};
    const offline=()=>setVerified(false);
    window.addEventListener('online',refresh);window.addEventListener('offline',offline);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',visible);
    const timer=setInterval(()=>void refresh(),60000);
    return()=>{sequence.current++;clearInterval(timer);window.removeEventListener('online',refresh);window.removeEventListener('offline',offline);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',visible);};
  },[lot,unit,authorized,initialVehicle]);
  useEffect(()=>{if(dialog&&modalRef.current){modalRef.current.showModal();return()=>modalRef.current?.close();}},[dialog]);
  function openAction(){if(busy)return;setMessage('');setIncidentError('');setDialog(active?'confirm-end':'confirm-start');}
  function beginForm(){
    const vehicle=initialVehicle||readSvbVehicleAssignment(storage,unit)||(service==='TSNU'?unit:'');
    setForm({...emptyForm(),vehicle});setVehicleNote('');setDialog('start');
    if(vehicle)void verifyVehicle(vehicle);
  }
  async function verifyVehicle(vehicle){const request=++vehicleLookup.current,cached=await lookupVehicle(vehicle);if(request===vehicleLookup.current)setVehicleNote(cached?'Datos del vehículo guardados en este móvil.':'Datos del vehículo pendientes de verificar. La comunicación se puede guardar sin conexión.');}
  async function saveAction(){
    if(lock.current)return;
    if(dialog==='start'&&form.hasPatient==='yes'&&!form.incidentReference.trim()){
      setIncidentError('Falta completar el número ID del incidente.');
      setMessage('Introduce el número ID del incidente.');
      incidentInputRef.current?.focus({preventScroll:true});
      incidentInputRef.current?.scrollIntoView({block:'center',behavior:'smooth'});
      return;
    }
    try{
      const operation=dialog==='start'
        ?operabilityStart({lot,unit,...form},newOperationId())
        :operabilityClose({lot,unit,incidentId:active?.id,resolution:form.resolution},newOperationId());
      // Hidden snapshot for offline use. Never rendered or trusted by the server.
      if(operation.type==='start')operation.vehicleIdentity=readCachedVehicle(storage,lot,operation.vehicle);
      commit({...current.current,pending:[...(current.current.pending||[]),operation]});
      setDialog('');setMessage('Comunicación guardada en este móvil. Pendiente de confirmación.');
      await synchronize();
    }catch(error){setMessage(error.message||'No se ha podido guardar. No cierres el formulario.');}
  }
  const tone=pending.length?'pending':active?'down':verified?'up':'unknown';
  const label=pending.length?(active?'Inoperatividad pendiente de confirmar':'Recuperación pendiente de confirmar'):active?'Inoperativa':verified?'Operativa':'Estado sin verificar';
  const vehicles=record.confirmed?.vehicles||[];
  return <div className="unit-operability">
    <button type="button" className={`unit-status unit-status-${tone}`} onClick={openAction} disabled={busy} aria-label={`${unit} · ${label}`}><strong>{unit}</strong><span>{label}</span></button>
    {active&&<small>Vehículo {active.vehicle} · Desde {operabilityTime(active.started_at)}</small>}
    {!verified&&record.confirmed&&<small>Último estado guardado · Pendiente de verificar conexión</small>}
    {pending.length>0&&<button type="button" className="unit-status-retry" onClick={synchronize} disabled={busy}>{busy?'Comprobando...':`Reintentar comunicación (${pending.length})`}</button>}
    {!verified&&!busy&&!pending.length&&<button type="button" className="unit-status-retry" onClick={refresh}>Verificar estado</button>}
    {message&&<p className="unit-status-message" role="status">{message}</p>}
    {dialog&&createPortal(<dialog ref={modalRef} className="operability-backdrop" onCancel={()=>setDialog('')} aria-label={dialog.includes('start')?'Declarar inoperatividad':'Recuperar operatividad'}><section className="operability-dialog">
      {dialog==='confirm-start'?<><h2>¿Quieres declarar la unidad inoperativa?</h2><p>Unidad {unit}. Todavía no se ha comunicado ningún cambio.</p><p>Registro interno de la PWA. No sustituye la comunicación operativa habitual al CECOS.</p><button type="button" className="primary" onClick={beginForm}>Sí, continuar</button></>
        :dialog==='confirm-end'?<><h2>¿Quieres volver a declarar la unidad operativa?</h2><p>Se cerrará la comunicación del vehículo {active?.vehicle}. Los datos originales se conservarán.</p><button type="button" className="primary" onClick={()=>{setForm(emptyForm());setDialog('end');}}>Sí, continuar</button></>
        :<><h2>{dialog==='start'?'Comunicar inoperatividad':'Comunicar recuperación'}</h2><p>{unit} · {lot} · {record.confirmed?.zone||'Zona pendiente de confirmar'}</p>
          {dialog==='start'?<>
            <label>Vehículo que lleva la unidad<input list={`operability-vehicles-${unit}`} value={form.vehicle} onChange={e=>{vehicleLookup.current++;setForm({...form,vehicle:e.target.value.toUpperCase()});setVehicleNote('');}} onBlur={()=>void verifyVehicle(form.vehicle)} autoComplete="off"/></label>
            <datalist id={`operability-vehicles-${unit}`}>{vehicles.map(row=><option key={row.vehicle} value={row.vehicle}/>)}</datalist>
            <small>{vehicleNote}</small>
            <label>Motivo<select value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}><option value="">Selecciona...</option>{INOPERABILITY_REASONS.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
            <label>¿Se ha producido estando activados, asistiendo o trasladando a algún afectado?<select value={form.hasPatient} onChange={e=>{setForm({...form,hasPatient:e.target.value,incidentReference:e.target.value==='yes'?form.incidentReference:''});setIncidentError('');setMessage('');}}><option value="">Selecciona...</option><option value="yes">Sí</option><option value="no">No</option></select></label>
            {form.hasPatient==='yes'&&<label>Número ID del incidente<input ref={incidentInputRef} required maxLength={100} className={incidentError?'operability-input-invalid':''} aria-invalid={Boolean(incidentError)} aria-describedby={incidentError?'operability-incident-error':undefined} value={form.incidentReference} onChange={e=>{setForm({...form,incidentReference:e.target.value});if(e.target.value.trim()){setIncidentError('');if(incidentError)setMessage('');}}} placeholder="Introduce el ID del incidente" autoComplete="off"/>{incidentError&&<span id="operability-incident-error" className="operability-field-error" role="alert">{incidentError}</span>}</label>}
            <label>Descripción de la inoperatividad<textarea maxLength={4000} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
            <label>Observaciones justificativas<textarea maxLength={4000} value={form.justification} onChange={e=>setForm({...form,justification:e.target.value})}/></label>
          </>:<label>Resolución y observaciones de recuperación<textarea maxLength={4000} value={form.resolution} onChange={e=>setForm({...form,resolution:e.target.value})}/></label>}
          <p>La fecha y hora se registran al confirmar. Si no hay conexión, queda pendiente de enviar.</p>
          <p>Este registro es interno y no envía avisos al CECOS. Mantén el procedimiento habitual de comunicación.</p>
          {message&&<p role="alert">{message}</p>}
          <button type="button" className="primary" disabled={busy} onClick={saveAction}>{dialog==='start'?'Confirmar inoperatividad':'Confirmar recuperación'}</button>
        </>}
      <button type="button" className="secondary" onClick={()=>{setDialog('');setMessage('');}}>Cancelar</button>
    </section></dialog>,document.body)}
  </div>;
}
