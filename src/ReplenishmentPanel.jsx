import React,{useState,useRef,useEffect} from 'react';
import {createPortal} from 'react-dom';
import {replenishmentKey,replenishmentDraft,replenishmentRowRequest,replenishmentShortages,
 boundedReplenishment,definitiveReplenishmentFailure,validReplenishmentQuantity,
 editReplenishmentRow,canRemoveReplenishmentRow,removeReplenishmentRow,
 reconcileReplenishment,completeReplenishment,reopenReplenishment,validateReplenishmentDraft} from './replenishment.mjs';
import './replenishment.css';

function ReplenishmentNotice({busy,message,refreshNotice,onDismiss}){
 const box=useRef(null),dismiss=useRef(onDismiss);
 dismiss.current=onDismiss;
 useEffect(()=>{const previous=document.activeElement;box.current?.focus();return()=>{if(previous?.isConnected)previous.focus();};},[]);
 return createPortal(<div className="replenishment-notice-backdrop"><section ref={box} tabIndex={-1} className="card replenishment-notice" role="alertdialog" aria-modal="true" aria-label={busy?'Confirmando reposición':'Aviso de reposición'} onKeyDown={e=>{
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(!busy)dismiss.current();}
  if(e.key==='Tab'){e.preventDefault();(box.current.querySelector('button')||box.current).focus();}
 }}>
  <h3>{busy?'Confirmando reposición…':'Aviso de reposición'}</h3>
  <div aria-live="polite">{busy?<p>Comprobando el inventario y registrando la entrega. Espera la confirmación del servidor.</p>:<>{message&&<p>{message}</p>}{refreshNotice&&<p>{refreshNotice}</p>}</>}</div>
  {!busy&&<button className="primary" onClick={onDismiss}>Entendido</button>}
 </section></div>,document.body);
}

export default function ReplenishmentPanel({scope,actor,groups,materials,materialLabel,levels,minimums,
 inventoryReady=true,onSubmit,onRefresh,onClose,onExcel,onPdf,storage=localStorage,preview=false}){
 const [destination,setDestination]=useState(''),[draft,setDraft]=useState(null);
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[refreshNotice,setRefreshNotice]=useState('');
 const [adding,setAdding]=useState(false),[search,setSearch]=useState(''),[extraMaterial,setExtraMaterial]=useState('');
 const [refreshing,setRefreshing]=useState(false),[verified,setVerified]=useState(false);
 const [snapshot,setSnapshot]=useState({groups,levels,minimums});
 const sending=useRef(false),active=useRef(true),destinationRef=useRef(''),generation=useRef(0);
 const snapshotRef=useRef(snapshot),refreshRef=useRef(onRefresh);
 refreshRef.current=onRefresh;
 useEffect(()=>{active.current=true;return()=>{active.current=false;++generation.current;};},[]);
 const key=destination?replenishmentKey(scope,actor,destination):'';
 const label=id=>Object.entries(scope.remoteIds).find(([,value])=>value===id)?.[0]||id;
 const proposals=(data,id)=>data.groups.find(g=>scope.remoteIds[g.location]===id)?.items||[];
 const rebase=(saved,data)=>reconcileReplenishment(saved,proposals(data,saved.destination),data.levels[label(saved.destination)],data.minimums[label(saved.destination)]);
 const frozen=busy||refreshing||!verified||!!draft?.request;
 const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().trim();
 const extraOptions=materials.filter(m=>!draft?.rows[m]&&normalize(materialLabel(m)).includes(normalize(search)));

 function read(id){
  const stored=storage.getItem(replenishmentKey(scope,actor,id));
  const saved=stored?JSON.parse(stored):replenishmentDraft(scope,id,[],crypto.randomUUID());
  return validateReplenishmentDraft(scope,saved,id);
 }
 function persist(next){
  // Persist before sending. Storage failure must never create an untracked operation.
  storage.setItem(replenishmentKey(scope,actor,next.destination),JSON.stringify(next));
  if(active.current&&destinationRef.current===next.destination)setDraft(next);
 }
 function acceptSnapshot(data){
  snapshotRef.current=data;setSnapshot(data);
  const id=destinationRef.current;
  if(!id||sending.current)return;
  try{const saved=read(id),next=rebase(saved,data);if(next!==saved)persist(next);else setDraft(saved);}
  catch{setMessage('No se pudo actualizar el borrador. Se conserva sin enviar.');}
 }
 // Loading is not an empty inventory. Never erase drafts during a parent refresh.
 useEffect(()=>{if(inventoryReady)acceptSnapshot({groups,levels,minimums});},[groups,levels,minimums,inventoryReady]);
 async function freshStock(){
  const result=await boundedReplenishment(()=>refreshRef.current?.(),null,8000);
  if(!result?.groups||!result.levels||!result.minimums)throw new Error('No se ha podido comprobar el inventario actual. No se ha enviado nada. Comprueba la conexión y vuelve a intentarlo.');
  return result;
 }
 async function refreshSelected({reopen=false}={}){
  const id=destinationRef.current,token=generation.current;
  if(!id||sending.current)return;
  setRefreshing(true);
  try{
   const data=await freshStock();
   if(!active.current||token!==generation.current)return;
   snapshotRef.current=data;setSnapshot(data);
   const saved=read(id);persist(rebase(reopen?reopenReplenishment(saved):saved,data));setVerified(true);
  }catch(error){if(active.current&&token===generation.current){setVerified(false);setRefreshNotice(error.message);}}
  finally{if(active.current&&token===generation.current)setRefreshing(false);}
 }
 function choose(id){
  ++generation.current;destinationRef.current=id;setDestination(id);setDraft(null);setVerified(false);
  setMessage('');setRefreshNotice('');setAdding(false);setSearch('');setExtraMaterial('');setRefreshing(false);
  if(!id)return;
  try{const saved=read(id);persist(saved);void refreshSelected({reopen:true});}catch(error){setMessage(error.message);}
 }
 useEffect(()=>{
  const handler=e=>{if(e.key===key&&!sending.current&&destinationRef.current){try{setDraft(read(destinationRef.current));}catch{setMessage('El borrador ha cambiado en otra pestaña. Cierra y vuelve a abrir esta pantalla.');}}};
  window.addEventListener('storage',handler);return()=>window.removeEventListener('storage',handler);
 },[key]);
 useEffect(()=>{
  const refresh=()=>{if(document.visibilityState==='visible'&&!sending.current&&!refreshing)void refreshSelected();};
  const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[key,refreshing]);

 function currentEditable(material){
  const saved=read(destination);
  if(saved.id!==draft.id||saved.request||JSON.stringify(saved.rows[material])!==JSON.stringify(draft.rows[material])){
   setDraft(saved);throw new Error('La lista ha cambiado en otra pestaña. Revisa los datos actualizados.');
  }
  return saved;
 }
 function edit(material,patch){
  if(frozen||draft.rows[material]?.registered)return false;
  try{const saved=currentEditable(material);persist(rebase({...saved,rows:{...saved.rows,[material]:editReplenishmentRow(saved.rows[material],patch)}},snapshotRef.current));return true;}
  catch(error){setMessage(error.message||'No se puede guardar el borrador. No se ha enviado nada.');return false;}
 }
 function removeExtra(material){
  if(frozen||sending.current)return;
  try{persist(removeReplenishmentRow(currentEditable(material),material,proposals(snapshotRef.current,destination)));}catch(error){setMessage(error.message);}
 }

 async function submit(material=null){
  if(sending.current||!draft)return;
  const expectedId=draft.id,expectedRow=material?JSON.stringify(draft.rows[material]):null;
  const id=destination,token=generation.current;
  sending.current=true;setBusy(true);setMessage('');setRefreshNotice('');
  let request=null;
  const run=async()=>{
   let saved=read(id);
   if(saved.id!==expectedId)throw new Error('La entrega ya se ha registrado o la lista ha cambiado. Revisa la lista actualizada.');
   if(material){
    if(saved.request)throw new Error('Hay un envío pendiente. Pulsa «Reintentar confirmación» antes de continuar.');
    const data=await freshStock();
    if(!active.current||token!==generation.current)throw new Error('La pantalla ha cambiado. No se ha enviado nada.');
    snapshotRef.current=data;setSnapshot(data);setVerified(true);
    saved=read(id); // Another tab may have edited during the network read.
    if(saved.id!==expectedId||saved.request||JSON.stringify(saved.rows[material])!==expectedRow)throw new Error('La lista ha cambiado en otra pestaña. Revisa los datos actualizados.');
    const updated=rebase(saved,data);persist(updated);
    if(JSON.stringify(updated.rows[material])!==expectedRow)throw new Error('El inventario o el mínimo ha cambiado. Hemos actualizado la cantidad necesaria. Revisa la lista; no se ha registrado ninguna entrega.');
    const candidate=replenishmentRowRequest(scope,updated,material,materials);
    if(replenishmentShortages(candidate,data.levels[scope.centralLabel]).length)throw new Error('Stock insuficiente en el almacén central. No se ha registrado la entrega.');
    // Persist the immutable payload before setting request: a storage error is not a send.
    saved={...updated,request:candidate};persist(saved);request=candidate;
   }else{
    request=saved.request;if(!request)throw new Error('No hay ningún envío pendiente. Revisa la lista actualizada.');
   }
   const receipt=await boundedReplenishment(onSubmit,request);
   const latest=read(id);
   if(latest.id!==expectedId||JSON.stringify(latest.request)!==JSON.stringify(request))throw new Error('DRAFT_CHANGED');
   persist(completeReplenishment(latest,receipt,crypto.randomUUID()));
   if(active.current)setMessage(preview?'PRUEBA: entrega registrada en el inventario simulado. No se ha modificado ningún almacén real.':`Entrega registrada en ${label(id)}. Referencia: ${receipt.request_id.slice(0,8)}.`);
   request=null; // Slow refresh cannot turn a confirmed receipt into an uncertain send.
   void freshStock().then(data=>{
    if(active.current&&token===generation.current){snapshotRef.current=data;setSnapshot(data);persist(rebase(read(id),data));setVerified(true);}
   }).catch(()=>{if(active.current&&token===generation.current)setRefreshNotice('Entrega registrada. El inventario tarda en actualizarse; no repitas esta entrega.');});
  };
  try{
   // Serialize tabs. Fallback browsers still share the id checked by the server.
   if(navigator.locks?.request)await navigator.locks.request(key,run);else await run();
  }catch(error){
   if(request){
    const definitive=definitiveReplenishmentFailure(error);
    if(definitive){try{const current=read(id);if(current.request?.p_request_id===request.p_request_id)persist({...current,request:null});}catch{}}
    if(active.current)setMessage(definitive?`No se ha registrado la entrega: ${error.message}. Revisa las cantidades.`:
     'No se ha podido confirmar el resultado. El envío queda guardado para evitar duplicados. Recupera la conexión y pulsa «Reintentar confirmación». No prepares otra entrega de estos materiales.');
   }else if(active.current){try{setDraft(read(id));}catch{}setMessage(error.message||'No se pudo guardar el borrador. No se ha enviado nada.');}
  }finally{sending.current=false;if(active.current)setBusy(false);}
 }
 return <div className="modal-backdrop"><section className="card export-modal stock-replenishment-modal replenishment-panel" role="dialog" aria-modal="true" aria-label="Reposición de almacenes">
  <header><h2>Qué llevar a cada almacén · Reposición</h2><button className="secondary" onClick={onClose} disabled={busy}>Cerrar</button></header>
  <p>{scope.lot} · {scope.zone}{preview?' · PRUEBA LOCAL SIN MOVIMIENTOS REALES':''}</p>
  <label>Almacén de destino<select value={destination} disabled={busy} onChange={e=>choose(e.target.value)}><option value="">Selecciona un almacén</option>{scope.locations.map(location=><option key={scope.remoteIds[location]} value={scope.remoteIds[location]}>{location}</option>)}</select></label>
  {(busy||message||refreshNotice)&&<ReplenishmentNotice busy={busy} message={message} refreshNotice={refreshNotice} onDismiss={()=>{setMessage('');setRefreshNotice('');}}/>}
  {draft&&<>
   <p className="replenishment-route"><b>Origen:</b> {draft.origin?label(draft.origin):'Entrada externa / proveedor'}<br/><b>Destino:</b> {label(destination)}</p>
   <p className="muted">Ajusta la cantidad que has dejado y confírmala en su botón. «Registrado» significa que el servidor ha guardado la entrega. No hay un segundo paso de envío.</p>
   {refreshing&&<p role="status">Actualizando existencias…</p>}
   {draft.request&&<p role="status">Hay un envío pendiente de confirmación. Sus cantidades se conservan sin cambios.</p>}
   <div className="replenishment-rows">{Object.entries(draft.rows).map(([material,row])=>{
    const invalid=!validReplenishmentQuantity(row.quantity),registered=!!row.registered;
    return <div key={material} className={`replenishment-row ${registered?'checked':''}`} data-material={material}><div><strong>{materialLabel(material)}</strong>{!registered&&canRemoveReplenishmentRow(draft,material,proposals(snapshot,destination))&&<button type="button" className="replenishment-remove" disabled={frozen} title="Eliminar material añadido de la lista" aria-label={`Eliminar de la lista: ${materialLabel(material)}`} onClick={()=>removeExtra(material)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg></button>}<small>Stock: {snapshot.levels[label(destination)]?.[material]||0} · Mínimo: {snapshot.minimums[label(destination)]?.[material]||0}</small>{row.manual&&!registered&&<small>Añadido manualmente</small>}</div>
     <label>{registered?'Entregado':'Cantidad a dejar'}<input type="number" inputMode="numeric" min="0" step="1" max="2147483647" disabled={frozen||registered} value={row.quantity} aria-invalid={invalid} aria-label={`Cantidad de ${materialLabel(material)}`} onChange={e=>edit(material,{quantity:e.target.value})}/>{invalid&&<small className="replenishment-invalid">Introduce una cantidad entera mayor que 0 para confirmar.</small>}</label>
     <button className={registered?'secondary replenishment-registered':'primary replenishment-deliver'} disabled={frozen||invalid||registered} onClick={()=>submit(material)}>{registered?'✓ Registrado':`Confirmar ${row.quantity||0} ${Number(row.quantity)===1?'unidad dejada':'unidades dejadas'}`}</button></div>;
   })}</div>
   {!Object.keys(draft.rows).length&&<p>No hay material pendiente de reponer. Puedes añadir otro material.</p>}
   <button className="secondary" disabled={frozen} onClick={()=>setAdding(!adding)}>Añadir otro material</button>
   {adding&&<div className="replenishment-add"><label>Buscar material<input type="search" placeholder="Ej. guantes, vendas…" value={search} disabled={frozen} onChange={e=>{setSearch(e.target.value);setExtraMaterial('');}}/></label>
    <p className="muted">Los materiales que ya están en la lista se editan directamente arriba.</p>
    {!extraOptions.length?<p role="status">No hay otros materiales que coincidan con esta búsqueda.</p>:<label>Material<select aria-label="Material añadido" value={extraMaterial} disabled={frozen} onChange={e=>setExtraMaterial(e.target.value)}><option value="">Selecciona material</option>{extraOptions.map(m=><option key={m} value={m}>{materialLabel(m)}</option>)}</select></label>}
    {search&&<button className="secondary" disabled={frozen} onClick={()=>{setSearch('');setExtraMaterial('');}}>Limpiar búsqueda</button>}
    <button className="primary" disabled={frozen||!extraOptions.includes(extraMaterial)} onClick={()=>{if(!edit(extraMaterial,{quantity:'1',checked:false,manual:true}))return;setExtraMaterial('');setSearch('');setAdding(false);}}>Añadir a la lista</button>
   </div>}
   <footer className="replenishment-footer" aria-busy={busy}>
    {(message||busy||refreshNotice)&&<div className="replenishment-footer-notice" role="status">{busy?'Comprobando y registrando la entrega…':message}{refreshNotice&&<small>{refreshNotice}</small>}</div>}
    <button className="secondary" disabled={busy} onClick={onClose}>Guardar y continuar después</button>
    {draft.request?<button className="primary" disabled={busy} onClick={()=>submit()}>Reintentar confirmación</button>:!verified&&!refreshing&&<button className="primary" onClick={()=>{setRefreshNotice('');void refreshSelected();}}>Actualizar inventario</button>}
   </footer>
  </>}
  <div className="toolbar">{onExcel&&<button className="secondary" disabled={busy||!inventoryReady} onClick={onExcel}>Exportar Excel</button>}{onPdf&&<button className="secondary" disabled={busy||!inventoryReady} onClick={onPdf}>Exportar PDF</button>}</div>
 </section></div>;
}
