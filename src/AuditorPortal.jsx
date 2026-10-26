import React,{useEffect,useRef,useState} from 'react';
import VehicleAudit from './VehicleAudit.jsx';
import {ensureAnonymousSession,supabase} from './supabase';
import {MATERIALS} from './data';
import {materialDisplayName} from './material-display.mjs';
import {readAudits} from './vehicle-audit.mjs';
import {rememberAuthorizedIdentity} from './auth-session-diagnostic.mjs';
import {rememberRecoverySession,forgetRecoverySession} from './device-session-recovery.mjs';
import {AUDITOR_MODE_KEY,AUDITOR_WORK_KEY,confirmedAuditorProfile,auditorError,mapServerAuditorDraft,sameAuditorMaterials,auditorNeedsSetup,clearAuditorLocalProfile} from './auditor-client.mjs';
import './auditor-portal.css';
import {AUDITOR_OFFLINE_KEY,readOfflineAuditor,rememberOfflineAuditor,auditorConnectionFailure,requireAuditScope} from './auditor-offline.mjs';

async function productionCall(name,args={}){
 if(navigator.onLine===false)throw new Error('AUDITOR_OFFLINE');
 const controller=new AbortController();let timer;
 const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('AUDITOR_REQUEST_TIMEOUT'));},20000);});
 try{return await Promise.race([(async()=>{
  await ensureAnonymousSession();if(controller.signal.aborted)throw new Error('AUDITOR_REQUEST_TIMEOUT');
  const {data,error}=await supabase.rpc(name,args).abortSignal(controller.signal);
  if(error)throw error;if(data?.error)throw new Error(data.error);return data;
 })(),deadline]);}finally{clearTimeout(timer);}
}
const readWork=storage=>{try{return JSON.parse(storage.getItem(AUDITOR_WORK_KEY)||'null');}catch{return null;}};
const newWork=revision=>({id:crypto.randomUUID(),revision,version:0,materials:{}});
function AuditorNotice({message,busy,onClose}){
 const dialog=useRef(null);
 useEffect(()=>{const node=dialog.current;if(!node.open)node.showModal();return()=>{if(node.open)node.close();};},[]);
 return <dialog ref={dialog} className="auditor-notice-dialog" aria-labelledby="auditor-notice-title" aria-describedby="auditor-notice-message" aria-busy={busy} onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
  <h2 id="auditor-notice-title">{busy?'Verificando...':'Aviso'}</h2>
  <p id="auditor-notice-message" role="status" aria-live="polite" aria-atomic="true">{message}</p>
  {!busy&&<button type="button" className="primary full" autoFocus onClick={onClose}>Aceptar</button>}
 </dialog>;
}
export default function AuditorPortal({onLeave,rpc=productionCall,storage:localStorage=window.localStorage,simulation=false,version='v250'}){
 const call=rpc;
 const [cachedProfile]=useState(()=>readOfflineAuditor(localStorage));
 const [canReview,setCanReview]=useState(!!cachedProfile),[connectionNote,setConnectionNote]=useState(cachedProfile?'Revisión local disponible. Comprobando conexión para el envío...':'');
 const [closeUnitRequired,setCloseUnitRequired]=useState(false),[closeUnitConfirmed,setCloseUnitConfirmed]=useState(false);
 const [profile,setProfile]=useState(null),[verified,setVerified]=useState(false),[loading,setLoading]=useState(true),[options,setOptions]=useState([]),[setup,setSetup]=useState(false),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[name,setName]=useState(''),[lot,setLot]=useState(''),[zone,setZone]=useState(''),[warehouse,setWarehouse]=useState(''),[code,setCode]=useState(''),[work,setWork]=useState(()=>readWork(localStorage)),[search,setSearch]=useState(''),[pending,setPending]=useState([]),[materialNames,setMaterialNames]=useState([]);
 const saveQueue=useRef(Promise.resolve()),currentWork=useRef(work),verifyRun=useRef(0),leaving=useRef(false),setupMode=useRef(false);
 const profileNow=useRef(cachedProfile),lastVerifyError=useRef(null),registeredDrafts=useRef(new Set());
 useEffect(()=>{if(cachedProfile){setProfile(cachedProfile);setLoading(false);}},[]);
 function verificationFailure(error){
  lastVerifyError.current=error;
  setVerified(false);
  if(auditorConnectionFailure(error)&&readOfflineAuditor(localStorage)){
   setCanReview(true);setConnectionNote('Sin conexión confirmada. Puedes seguir revisando; las marcas se guardan en este móvil. La auditoría no se enviará sin confirmación.');
  }else{setCanReview(false);localStorage.removeItem(AUDITOR_OFFLINE_KEY);setNotice(auditorError(error));}
 }
 useEffect(()=>{setupMode.current=setup;},[setup]);
 async function verify(){
  if(leaving.current)return;
  const run=++verifyRun.current;setVerified(false);lastVerifyError.current=null;
  try{
   const raw=await call('get_my_auditor_profile');if(run!==verifyRun.current)return;
   const p=confirmedAuditorProfile(raw);setProfile(raw);
   if(auditorNeedsSetup(raw)){
    lastVerifyError.current=new Error('AUDITOR_NOT_AUTHORIZED');
    setCanReview(false);localStorage.removeItem(AUDITOR_OFFLINE_KEY);profileNow.current=null;
    setName(raw?.full_name||'');setLot(raw?.lot||'');setZone(raw?.zone||'');setWarehouse(raw?.warehouse_id||'');setCode('');setupMode.current=true;setSetup(true);
    if(raw)setNotice('Este perfil auditor está inactivo. Autorízalo de nuevo con el código del propietario o supervisor de la zona.');
    return;
   }
   if(!p){lastVerifyError.current=new Error('AUDITOR_NOT_AUTHORIZED');profileNow.current=null;setCanReview(false);localStorage.removeItem(AUDITOR_OFFLINE_KEY);setNotice('Acceso no autorizado. Contacta con el propietario o la supervisión.');return;}
   for(const draft of readAudits(localStorage).filter(d=>!d.confirmedAt&&d.supervisor?.startsWith('Auditor ·')))requireAuditScope(draft,p);
   profileNow.current=p;
   // Server-confirmed profile can authorize local editing, not an upload.
   if(simulation){localStorage.setItem('cma_mobile_role_v1','auditor');localStorage.setItem('cma_unit',`Auditor · ${p.zone} · ${p.full_name}`);localStorage.setItem('cma_lot',p.lot);rememberAuthorizedIdentity(localStorage,p.user_id);}
   rememberOfflineAuditor(localStorage,p);setCanReview(true);
   const [remoteDrafts,remoteWork,names]=await Promise.all([call('get_my_auditor_pending_audits'),call('get_my_auditor_materials'),call('get_my_auditor_material_options')]);
   if(run!==verifyRun.current)return;
   setPending(remoteDrafts||[]);setMaterialNames(names||[]);
   let local=readWork(localStorage);
   if(local&&Object.values(local.materials||{}).some(Number)){
    const receipt=await call('get_my_auditor_consumption',{p_id:local.id});
    if(receipt&&receipt.profile_revision===local.revision&&sameAuditorMaterials(receipt.materials,local.materials)){local=null;localStorage.removeItem(AUDITOR_WORK_KEY);}
   }
   let next=local;
   if(local&&local.revision!==p.revision&&Object.values(local.materials||{}).some(Number))throw new Error('AUDITOR_ASSIGNMENT_CHANGED');
   if(!local||local.revision!==p.revision)next=remoteWork?{id:remoteWork.id,revision:remoteWork.profile_revision,version:Number(remoteWork.edit_version),materials:remoteWork.materials}:newWork(p.revision);
   else if(remoteWork&&remoteWork.id===local.id&&Number(remoteWork.edit_version)>local.version)next={id:remoteWork.id,revision:p.revision,version:Number(remoteWork.edit_version),materials:remoteWork.materials};
   if(run!==verifyRun.current)return;
   currentWork.current=next;setWork(next);localStorage.setItem(AUDITOR_WORK_KEY,JSON.stringify(next));setupMode.current=false;setSetup(false);setVerified(true);setConnectionNote('');setNotice('');return true;
  }catch(error){if(run===verifyRun.current)verificationFailure(error);}
  finally{if(run===verifyRun.current)setLoading(false);}
 }
 useEffect(()=>{void verify();void call('get_auditor_warehouse_options').then(setOptions).catch(error=>{if(!auditorConnectionFailure(error))setNotice(auditorError(error));});
  const refresh=()=>{if(!document.hidden&&!setupMode.current)void verify();};
  const offline=()=>{setVerified(false);setConnectionNote('Sin conexión. Puedes seguir revisando en este móvil. El envío queda pendiente de conexión.');};
  window.addEventListener('offline',offline);window.addEventListener('online',refresh);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  return()=>{verifyRun.current++;window.removeEventListener('offline',offline);window.removeEventListener('online',refresh);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[]);
 function hasLocalPending(){
  try{return Object.values(currentWork.current?.materials||{}).some(Number)||readAudits(localStorage).some(row=>row.supervisor?.startsWith('Auditor ·')&&!row.confirmedAt);}catch{return true;}
 }
 async function openSetup(){
  if(hasLocalPending()||pending.length){setNotice('Termina y envía las auditorías y consumos pendientes antes de cambiar de zona.');return;}
  try{setOptions(await call('get_auditor_warehouse_options'));}catch(error){setVerified(false);setNotice(auditorError(error));return;}
  setName(profile?.full_name||'');setLot(profile?.lot||'');setZone(profile?.zone||'');setWarehouse(profile?.warehouse_id||'');setCode('');setupMode.current=true;setSetup(true);setNotice('');
 }
 async function authorize(event){
  event.preventDefault();if(closeUnitRequired&&!closeUnitConfirmed){setNotice('Confirma el cierre de la guardia anterior antes de cambiar el perfil.');return;}setBusy(true);setVerified(false);setNotice('Verificando la asignación con el servidor...');
  try{
   if(hasLocalPending())throw new Error('AUDITOR_PENDING_WORK');
   const expected={full_name:name.trim().replace(/\s+/g,' '),lot,zone,warehouse_id:warehouse};
   const result=await call('authorize_mobile_auditor',{p_code:code,p_full_name:expected.full_name,p_lot:lot,p_zone:zone,p_warehouse_id:warehouse,p_close_unit:closeUnitRequired&&closeUnitConfirmed});
   const confirmed=confirmedAuditorProfile(result,expected);if(!confirmed)throw new Error('AUDITOR_WAREHOUSE_MISMATCH');
   // Invalidate any focus/background verification started before authorization.
   verifyRun.current++;
   localStorage.removeItem(AUDITOR_WORK_KEY);localStorage.removeItem('cma_device_authorization_v1');localStorage.removeItem('cma_svb_checklist_context_v1');localStorage.removeItem('cma_tsnu_active_shift_v1');
   localStorage.setItem('cma_unit',`Auditor · ${confirmed.zone} · ${confirmed.full_name}`);localStorage.setItem('cma_lot',confirmed.lot);
   if(!simulation){rememberAuthorizedIdentity(localStorage,confirmed.user_id);void supabase.auth.getSession().then(({data})=>data.session&&rememberRecoverySession(data.session,localStorage)).catch(()=>{});}
   localStorage.setItem(AUDITOR_MODE_KEY,'auditor');setProfile(confirmed);setupMode.current=false;setSetup(false);setCode('');
   if(await verify())setNotice(simulation?'Simulación completada. Asignación ficticia validada; no se han enviado datos reales.':'Asignación y almacén confirmados por el servidor.');
  }catch(error){if(String(error.message).includes('UNIT_SHIFT_MUST_BE_CLOSED'))setCloseUnitRequired(true);setNotice(auditorError(error));}finally{setBusy(false);}
 }
 function edit(material,delta){
  if(!verified||busy)return;
  const old=currentWork.current||newWork(profile.revision),materials={...old.materials},value=Math.max(0,(materials[material]||0)+delta);
  if(value)materials[material]=value;else delete materials[material];
  const next={...old,version:old.version+1,materials};
  try{localStorage.setItem(AUDITOR_WORK_KEY,JSON.stringify(next));}catch{setNotice('No se ha podido guardar el material en este móvil. No se ha cambiado la selección.');return;}
  currentWork.current=next;setWork(next);
  saveQueue.current=saveQueue.current.catch(()=>{}).then(()=>call('save_mobile_auditor_materials',{p_id:next.id,p_revision:next.revision,p_version:next.version,p_items:next.materials}));
  saveQueue.current.catch(error=>setNotice(auditorError(error)));
 }
 async function send(){
  if(!verified||busy||!Object.values(work?.materials||{}).some(Number))return;
  setBusy(true);const selected=structuredClone(currentWork.current);
  try{
   if(!await verify())throw lastVerifyError.current||new Error('AUDITOR_REQUEST_TIMEOUT');
   await saveQueue.current.catch(()=>{});
   try{await call('save_mobile_auditor_materials',{p_id:selected.id,p_revision:selected.revision,p_version:selected.version,p_items:selected.materials});}
   catch(error){if(!String(error.message).includes('AUDITOR_CONSUMPTION_ALREADY_SENT'))throw error;}
   const result=await call('submit_mobile_auditor_consumption',{p_id:selected.id,p_revision:selected.revision,p_warehouse_id:profile.warehouse_id,p_items:selected.materials});
   if(result.id!==selected.id||result.warehouse_id!==profile.warehouse_id)throw new Error('AUDITOR_WAREHOUSE_MISMATCH');
   const next=newWork(profile.revision);localStorage.setItem(AUDITOR_WORK_KEY,JSON.stringify(next));currentWork.current=next;setWork(next);
   setNotice(simulation?`Simulación de consumo completada en ${profile.warehouse_name}. No se ha descontado material real.`:`Consumo enviado y confirmado. Material descontado de ${profile.warehouse_name}.`);
  }catch(error){setNotice(auditorError(error));}finally{setBusy(false);}
 }
 async function leave(){
  if(hasLocalPending()||pending.length){setNotice('Termina y envía primero los trabajos pendientes.');return;}
  leaving.current=true;verifyRun.current++;setBusy(true);
  try{await saveQueue.current;if(profile?.active)await call('leave_mobile_auditor');const wasAuditor=clearAuditorLocalProfile(localStorage);if(wasAuditor&&!simulation)void forgetRecoverySession().catch(()=>{});onLeave();}catch(error){setNotice(auditorError(error));}finally{leaving.current=false;setBusy(false);}
 }
 async function registerDraft(draft,p=profileNow.current){
  requireAuditScope(draft,p);
  const key=`${p.user_id}:${p.revision}:${draft.id}`;if(registeredDrafts.current.has(key))return;
  const result=await call('begin_mobile_auditor_audit',{p_id:draft.id,p_revision:p.revision,p_vehicle:draft.vehicle,p_type:draft.type,p_catalog:draft.catalog});
  registeredDrafts.current.add(key);return result;
 }
 const service=profile&&{
  begin:async draft=>{
   if(!canReview)throw new Error('AUDITOR_NOT_AUTHORIZED');
   Object.assign(draft,{auditorUserId:profile.user_id,profileRevision:profile.revision,warehouseId:profile.warehouse_id});
   if(!verified){setPending(old=>[...old,{id:draft.id,vehicle:draft.vehicle}]);return;}
   try{await registerDraft(draft);}catch(error){verificationFailure(error);if(!auditorConnectionFailure(error))throw error;}
   setPending(old=>[...old,{id:draft.id,vehicle:draft.vehicle}]);
  },
  save:async draft=>{
   if(!verified)return false;
   try{await registerDraft(draft);return await call('save_mobile_auditor_draft',{p_id:draft.id,p_revision:profile.revision,p_version:draft.editVersion,p_answers:draft.answers,p_notes:draft.notes});}
   catch(error){verificationFailure(error);if(!auditorConnectionFailure(error))throw error;return false;}
  },
  submit:async draft=>{
   if(!await verify())throw lastVerifyError.current||new Error('AUDITOR_REQUEST_TIMEOUT');
   const p=profileNow.current;requireAuditScope(draft,p);
   await registerDraft(draft,p);
   await call('save_mobile_auditor_draft',{p_id:draft.id,p_revision:p.revision,p_version:draft.editVersion||1,p_answers:draft.answers,p_notes:draft.notes||{}});
   const items=draft.catalog.map(item=>({...item,status:draft.answers[item.id],note:String(draft.notes?.[item.id]||'').slice(0,1000)}));
   const result=await call('submit_mobile_auditor_audit',{p_id:draft.id,p_revision:p.revision,p_vehicle:draft.vehicle,p_type:draft.type,p_items:items});
   setPending(old=>old.filter(row=>row.id!==draft.id));return result;
  },
  pending:async()=>{
   if(!verified)return [];
   try{const rows=await call('get_my_auditor_pending_audits');setPending(rows||[]);return (rows||[]).map(mapServerAuditorDraft);}
   catch(error){verificationFailure(error);if(auditorConnectionFailure(error))return [];throw error;}
  },
 };
 return <div className="app auditor-mobile"><header className="header"><div className="header-copy"><h1>Control de material <span className="app-version">{version}</span></h1><small>Auditorías y consumo de material</small>{profile&&<><div className="unit-header">{profile.full_name}</div><div>{profile.lot} · {profile.zone}</div></>}</div><img className="falck-header-logo" src="./falck-symbol-2026.png" alt="Falck"/></header><main>
  <div className="auditor-toolbar"><button className="secondary" disabled={busy||loading} onClick={openSetup}>Cambiar zona</button><button className="secondary" disabled={busy||loading} onClick={leave}>Cambiar perfil</button></div>
  {notice&&<AuditorNotice message={notice} busy={busy} onClose={()=>setNotice('')}/>}
  {connectionNote&&<p className="auditor-notice" role="status">{connectionNote}</p>}
  {simulation&&<div className="auditor-notice">SIMULACIÓN LOCAL · Datos ficticios. No envía datos, no autoriza móviles ni modifica estoc real. La confirmación real solo se habilitará tras instalar y verificar el SQL.</div>}
  {!loading&&!verified&&(!profile||setup)&&<button type="button" className="secondary full" disabled={busy} onClick={()=>{void verify();void call('get_auditor_warehouse_options').then(setOptions).catch(error=>setNotice(auditorError(error)));}}>Volver a verificar</button>}
  {setup&&closeUnitRequired&&<label className="card"><input type="checkbox" checked={closeUnitConfirmed} onChange={e=>setCloseUnitConfirmed(e.target.checked)}/> Confirmo el cierre de la guardia anterior de este móvil. Si su checklist no se envió, seguirá como «No realizado»; no se marcará como completado.</label>}
  {loading?<div className="card">Verificando autorización y almacén...</div>:!setup&&profile&&<section className={`card auditor-confirmation ${verified?'confirmed':''}`} role="status"><strong>{verified?(simulation?'Simulación · Asignación validada del ejemplo':'✓ Almacén confirmado por el servidor'):'Almacén no verificado · Envío bloqueado'}</strong><p>{profile.warehouse_name||profile.warehouse_id}</p><small>{profile.lot} · {profile.zone}</small>{!verified&&<button className="secondary full" onClick={verify}>Volver a verificar</button>}</section>}
  {setup&&<form className="card" onSubmit={authorize}><h2>{profile?'Cambiar asignación':'Configurar móvil auditor'}</h2><label>Nombre y apellidos<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)} autoComplete="name"/></label><label>Lote<select required value={lot} onChange={e=>{setLot(e.target.value);setZone('');setWarehouse('');}}><option value="">Selecciona...</option>{[...new Set(options.map(w=>w.lot))].sort().map(l=><option key={l}>{l}</option>)}</select></label><label>Zona<select required value={zone} onChange={e=>{setZone(e.target.value);setWarehouse('');}}><option value="">Selecciona...</option>{[...new Set(options.filter(w=>w.lot===lot).map(w=>w.zone))].sort().map(z=><option key={z}>{z}</option>)}</select></label><label>Almacén de retirada de material<select required value={warehouse} onChange={e=>setWarehouse(e.target.value)}><option value="">Selecciona...</option>{options.filter(w=>w.lot===lot&&w.zone===zone).map(w=><option key={w.id} value={w.id}>{w.kind==='central'?'Central':'Subalmacén'} · {w.name}</option>)}</select></label><label>Código del propietario o supervisor de esta zona<input required type="password" value={code} autoComplete="off" onChange={e=>setCode(e.target.value)}/></label><p className="muted">El código autoriza solo este perfil. No abre administración ni sustituye otros móviles.</p><button disabled={busy} className="primary full">{busy?'Verificando...':'Autorizar y confirmar almacén'}</button>{profile&&<button type="button" disabled={busy} className="secondary full" onClick={()=>{setSetup(false);setCode('');void verify();}}>Cancelar</button>}</form>}
  {!setup&&profile&&<><VehicleAudit key={`${profile.user_id}:${profile.revision}`} supervisor={`Auditor · ${profile.zone} · ${profile.full_name}`} lot={profile.lot} zone={profile.zone} authorized={canReview} sendAuthorized={verified} auditorService={service} storageOverride={localStorage} onAlert={setNotice}/>
  <section className="card"><h2>Material retirado</h2><p>Se descontará de <strong>{profile.warehouse_name}</strong> al enviar y confirmar el consumo.</p><label>Buscar material<input value={search} onChange={e=>setSearch(e.target.value)}/></label>{(materialNames.length?materialNames:[]).filter(m=>MATERIALS.includes(m)&&materialDisplayName(m).toLowerCase().includes(search.toLowerCase())).map(m=><div className="material" key={m}><span>{materialDisplayName(m)}</span><div className="counter"><button disabled={!verified||busy} onClick={()=>edit(m,-1)}>−</button><span className="qty">{work?.materials?.[m]||0}</span><button disabled={!verified||busy} onClick={()=>edit(m,1)}>+</button></div></div>)}</section>
  <footer className="auditor-send-bar" aria-label="Envío de consumo de auditor"><button type="button" className="primary" disabled={!verified||busy||!Object.values(work?.materials||{}).some(Number)} onClick={send}>{busy?'Confirmando...':'Enviar consumo'}</button></footer></>}
 </main></div>;
}
