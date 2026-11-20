import React,{useState,useRef,useEffect} from 'react';
import {replenishmentKey,replenishmentDraft,replenishmentRequest,replenishmentShortages,boundedReplenishment,definitiveReplenishmentFailure} from './replenishment.mjs';
import './replenishment.css';

export default function ReplenishmentPanel({scope,actor,groups,materials,materialLabel,levels,minimums,onSubmit,onRefresh,onClose,onExcel,onPdf,storage=localStorage,preview=false}){
 const [destination,setDestination]=useState(''),[draft,setDraft]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[confirmation,setConfirmation]=useState(null),[adding,setAdding]=useState(false),[search,setSearch]=useState(''),[extraMaterial,setExtraMaterial]=useState('');
 const sending=useRef(false),active=useRef(true);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 const key=destination?replenishmentKey(scope,actor,destination):'';
 const label=id=>Object.entries(scope.remoteIds).find(([,value])=>value===id)?.[0]||id;
 const group=groups.find(g=>scope.remoteIds[g.location]===destination);
 const frozen=busy||!!draft?.request;
 const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().trim();
 const extraOptions=materials.filter(m=>!draft?.rows[m]&&normalize(materialLabel(m)).includes(normalize(search)));
 function persist(next){
  try{storage.setItem(replenishmentKey(scope,actor,next.destination),JSON.stringify(next));setDraft(next);return true;}
  catch{setMessage('No se puede guardar el borrador en este dispositivo. No se ha enviado nada. Libera espacio antes de continuar.');return false;}
 }
 function choose(id){
  setMessage('');setConfirmation(null);setAdding(false);setSearch('');setExtraMaterial('');setDestination(id);setDraft(null);
  if(!id){setDraft(null);return;}
  try{
   const stored=storage.getItem(replenishmentKey(scope,actor,id));
   const next=stored?JSON.parse(stored):replenishmentDraft(scope,id,groups.find(g=>scope.remoteIds[g.location]===id)?.items||[],crypto.randomUUID());
   if(next.version!==1||next.destination!==id||!next.rows||!next.id)throw new Error('Invalid draft');
   // Include newly detected needs when reopening, without overwriting edited quantities
   // or changing an uncertain request that must be retried byte-for-byte.
   if(!next.request)for(const item of groups.find(g=>scope.remoteIds[g.location]===id)?.items||[]){
    if(!next.rows[item.material])next.rows[item.material]={quantity:String(item.replenish),checked:false};
   }
   persist(next);
  }catch{setDraft(null);setMessage('No se ha podido recuperar el borrador. No se ha borrado: solicita revisión antes de preparar otra entrega.');}
 }
 useEffect(()=>{
  const handler=e=>{if(e.key===key&&!sending.current){setConfirmation(null);choose(destination);}};
  window.addEventListener('storage',handler);return()=>window.removeEventListener('storage',handler);
 },[key,destination,groups]);
 function edit(material,patch){
  if(frozen)return;
  try{const saved=JSON.parse(storage.getItem(key));if(saved?.id!==draft.id||saved?.request){choose(destination);setMessage('El borrador ha cambiado en otra pestaña. Revisa los datos actualizados.');return;}}catch{return;}
  return persist({...draft,rows:{...draft.rows,[material]:{...draft.rows[material],...patch}}});
 }
 function prepare(){
  setMessage('');
  try{
   const request=replenishmentRequest(scope,draft,materials);
   const missing=replenishmentShortages(request,levels[scope.centralLabel]);
   if(missing.length)throw new Error('Stock insuficiente en origen: '+missing.map(([m,q])=>`${materialLabel(m)} (solicitas ${q}, hay ${levels[scope.centralLabel]?.[m]||0})`).join('; '));
   setConfirmation(request);
  }catch(error){setMessage(error.message);}
 }
 async function submit(request){
  if(sending.current)return;
  sending.current=true;setBusy(true);setMessage('');setConfirmation(null);
  try{
   const current=JSON.parse(storage.getItem(key));
   if(current?.id!==draft.id|| (current.request&&JSON.stringify(current.request)!==JSON.stringify(request)))throw new Error('DRAFT_CHANGED');
   if(!persist({...draft,request}))return;
   const receipt=await boundedReplenishment(onSubmit,request);
   if(receipt?.request_id!==request.p_request_id)throw new Error('UNCONFIRMED_RECEIPT');
   // Retain unchecked materials. Checked quantities are cleared only after a server receipt.
   const remaining=Object.fromEntries(Object.entries(draft.rows).filter(([,r])=>!r.checked));
   const next={...draft,id:crypto.randomUUID(),rows:remaining,request:null};
   if(!persist(next)){if(active.current)setMessage('El servidor ha confirmado la reposición, pero no se pudo limpiar el borrador. Reintentar la misma operación no duplicará el movimiento.');return;}
   if(active.current)setMessage(preview?'PRUEBA: reposición simulada. No se ha modificado ningún almacén.':`Reposición confirmada por el servidor en ${label(destination)}. Referencia: ${receipt.request_id.slice(0,8)}.`);
   try{await onRefresh?.();}catch{if(active.current)setMessage('Reposición confirmada. No se ha podido actualizar el inventario; ciérralo y vuelve a cargarlo. No repitas la entrega.');}
  }catch(error){
   if(definitiveReplenishmentFailure(error))persist({...draft,request:null});
   if(active.current)setMessage(definitiveReplenishmentFailure(error)?`No se ha registrado la reposición: ${error.message}. Revisa las cantidades y actualiza el inventario.`:
    'No se ha podido confirmar el resultado. El envío queda guardado y bloqueado para evitar duplicados. Recupera la conexión y pulsa «Reintentar confirmación». No prepares otra entrega con estos mismos materiales.');
  }finally{sending.current=false;if(active.current)setBusy(false);}
 }
 return <div className="modal-backdrop"><section className="card export-modal stock-replenishment-modal replenishment-panel" role="dialog" aria-modal="true" aria-label="Reposición de almacenes">
  <header><h2>Qué llevar a cada almacén · Reposición</h2><button className="secondary" onClick={onClose} disabled={busy}>Cerrar</button></header>
  <p>{scope.lot} · {scope.zone}{preview?' · PRUEBA LOCAL SIN MOVIMIENTOS REALES':''}</p>
  <label>Almacén de destino<select value={destination} disabled={busy} onChange={e=>choose(e.target.value)}><option value="">Selecciona un almacén</option>{scope.locations.map(location=><option key={scope.remoteIds[location]} value={scope.remoteIds[location]}>{location}</option>)}</select></label>
  {message&&<p className="replenishment-message" role="alert">{message}</p>}
  {draft&&<>
   <p className="replenishment-route"><b>Origen:</b> {draft.origin?label(draft.origin):'Entrada externa / proveedor'}<br/><b>Destino:</b> {label(destination)}</p>
   <p className="muted">Edita la cantidad realmente entregada y marca «Dejado». El stock solo cambia al confirmar. El borrador se conserva en este navegador.</p>
   {draft.request&&<p role="status">Pendiente de confirmación del servidor. No se pueden cambiar las cantidades hasta resolver este envío.</p>}
   <div className="replenishment-rows">{Object.entries(draft.rows).map(([material,row])=>{
    const proposal=group?.items.find(i=>i.material===material);
    return <div key={material} className={`replenishment-row ${row.checked?'checked':''}`}><div><strong>{materialLabel(material)}</strong><small>Stock: {levels[label(destination)]?.[material]||0} · Mínimo: {minimums[label(destination)]?.[material]||0} · Propuesto: {proposal?.replenish||0}</small></div>
     <label>Cantidad<input type="number" inputMode="numeric" min="1" step="1" max="2147483647" disabled={frozen} value={row.quantity} aria-label={`Cantidad de ${materialLabel(material)}`} onChange={e=>edit(material,{quantity:e.target.value})}/></label>
     <label className="replenishment-check"><input type="checkbox" disabled={frozen} checked={row.checked} onChange={e=>edit(material,{checked:e.target.checked})}/>Dejado</label></div>;
   })}</div>
   {!Object.keys(draft.rows).length&&<p>No hay materiales propuestos. Puedes añadir otro material.</p>}
   <button className="secondary" disabled={frozen} onClick={()=>setAdding(!adding)}>Añadir otro material</button>
   {adding&&<div className="replenishment-add"><label>Buscar material<input type="search" placeholder="Ej. guantes, vendas…" value={search} disabled={frozen} onChange={e=>{setSearch(e.target.value);setExtraMaterial('');}}/></label>
    <p className="muted">Los materiales que ya están en la lista se editan directamente arriba.</p>
    {!extraOptions.length?<p role="status">No hay otros materiales que coincidan con esta búsqueda.</p>:<label>Material<select value={extraMaterial} disabled={frozen} onChange={e=>setExtraMaterial(e.target.value)}><option value="">Selecciona material</option>{extraOptions.map(m=><option key={m} value={m}>{materialLabel(m)}</option>)}</select></label>}
    {search&&<button className="secondary" disabled={frozen} onClick={()=>{setSearch('');setExtraMaterial('');}}>Limpiar búsqueda</button>}
    <button className="primary" disabled={frozen||!extraOptions.includes(extraMaterial)} onClick={()=>{if(!edit(extraMaterial,{quantity:'1',checked:false}))return;setMessage(`${materialLabel(extraMaterial)} añadido a la lista. Ajusta la cantidad y marca «Dejado» solo si lo has entregado.`);setExtraMaterial('');setSearch('');setAdding(false);}}>Añadir a la lista</button>
   </div>}
   <footer className="replenishment-footer"><button className="secondary" disabled={busy} onClick={onClose}>Guardar y continuar después</button><button className="primary" disabled={busy} onClick={()=>draft.request?submit(draft.request):prepare()}>{busy?'Confirmando…':draft.request?'Reintentar confirmación':'Confirmar reposición'}</button></footer>
  </>}
  <div className="toolbar">{onExcel&&<button className="secondary" disabled={busy} onClick={onExcel}>Exportar Excel</button>}{onPdf&&<button className="secondary" disabled={busy} onClick={onPdf}>Exportar PDF</button>}</div>
  {confirmation&&<div className="modal-backdrop"><section className="card replenishment-confirm" role="alertdialog" aria-modal="true" aria-label="Confirmar entrega"><h3>Confirmar entrega en {label(destination)}</h3><p>Origen: {draft.origin?label(draft.origin):'Entrada externa / proveedor'}</p><ul>{Object.entries(confirmation.p_items).map(([m,q])=><li key={m}>{materialLabel(m)}: <b>{q}</b></li>)}</ul>
   {draft.origin&&Object.entries(confirmation.p_items).some(([m,q])=>Number(levels[scope.centralLabel]?.[m]||0)-q<Number(minimums[scope.centralLabel]?.[m]||0))&&<p role="alert">Aviso: el almacén de origen quedará por debajo del mínimo en algún material.</p>}
   <p>Solo se registrarán estos materiales. ¿Confirmas que ya los has dejado?</p><button className="secondary" onClick={()=>setConfirmation(null)}>Revisar</button><button className="primary" onClick={()=>submit(confirmation)}>Sí, registrar entrega</button></section></div>}
 </section></div>;
}
