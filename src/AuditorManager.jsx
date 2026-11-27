import React,{useEffect,useRef,useState} from 'react';
import {supabase} from './supabase';
import {auditorRegistrationLabel} from './auditor-client.mjs';
import {auditorLastAuthorization,auditorAdminRequest,auditorAdminError} from './auditor-admin.mjs';
import './auditor-manager.css';

const productionCall=(name,args)=>auditorAdminRequest(supabase,name,args);
function AuditorAccessDialog({target,notice,busy,onCancel,onConfirm}){
 const ref=useRef(null);
 useEffect(()=>{const node=ref.current;if(!node.open)node.showModal();return()=>{if(node.open)node.close();};},[]);
 return <dialog ref={ref} className="auditor-access-dialog" aria-labelledby="auditor-access-title" aria-busy={busy} onCancel={e=>{e.preventDefault();if(!busy)onCancel();}}>
  <h2 id="auditor-access-title">{target?'¿Revocar este móvil auditor?':'Aviso'}</h2>
  {target?<><p><strong>{target.full_name}</strong><br/>Móvil {target.user_id.slice(0,8)}<br/>{target.lot} · {target.zone}<br/>Almacén: {target.warehouse_name}</p>
   <p>Este móvil no podrá enviar auditorías ni consumos hasta que vuelva a ser autorizado. No se borrarán sus trabajos guardados ni se desactivarán otros móviles.</p>
   {Number(target.pending_audits_count)>0&&<p>Tiene {target.pending_audits_count} auditoría(s) pendiente(s) en el servidor. Se conservarán.</p>}
   {target.pending_materials===true&&<p>Tiene material pendiente de enviar. Se conservará.</p>}
   <div className="auditor-access-actions"><button autoFocus type="button" className="secondary" disabled={busy} onClick={onCancel}>Cancelar</button><button type="button" className="danger" disabled={busy} onClick={onConfirm}>{busy?'Comprobando...':'Sí, revocar este móvil'}</button></div>
  </>:<><p role="status">{notice}</p><button autoFocus type="button" className="primary full" onClick={onCancel}>Aceptar</button></>}
 </dialog>;
}

export default function AuditorManager({access,compact=false,rpc=productionCall}){
 const [open,setOpen]=useState(false),[rows,setRows]=useState([]),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[target,setTarget]=useState(null),[stale,setStale]=useState(true);
 const inFlight=useRef(false);
 if(!['owner','supervisor'].includes(access?.role))return null;
 async function readRows(){
  const data=await rpc('list_mobile_auditors');
  if(!Array.isArray(data)||data.some(row=>!row||typeof row.user_id!=='string'||typeof row.active!=='boolean'))throw new Error('AUDITOR_LIST_NOT_CONFIRMED');
  setRows((data||[]).filter(row=>row.active===true));setStale(false);return data;
 }
 async function load(){
  if(inFlight.current)return;inFlight.current=true;setBusy(true);setOpen(true);
  try{await readRows();setNotice('');}catch(error){setStale(true);setNotice(auditorAdminError(error));}
  finally{inFlight.current=false;setBusy(false);}
 }
 function requestRevoke(row){
  if(inFlight.current||stale||row.active!==true)return;
  setNotice('');setTarget({...row});
 }
 function cancelDialog(){if(inFlight.current)return;setTarget(null);setNotice('');}
 async function revoke(){
  if(inFlight.current||stale||!target)return;
  const selected=target;inFlight.current=true;setBusy(true);setStale(true);
  let confirmed=false;
  try{
   const result=await rpc('revoke_mobile_auditor_checked',{p_user_id:selected.user_id,p_expected_revision:selected.revision,p_expected_updated_at:selected.updated_at});
   if(result!==true)throw new Error('AUDITOR_REVOKE_NOT_CONFIRMED');
   confirmed=true;
   const current=await readRows();const found=current.find(row=>row.user_id===selected.user_id);
   if(found?.active===false)setNotice('Acceso revocado y comprobado. Las auditorías y los consumos guardados se conservan.');
   else if(found?.active===true)setNotice('El servidor vuelve a mostrar este móvil activo. Comprueba la última autorización antes de actuar de nuevo.');
   else setNotice('El servidor ha confirmado la revocación, pero el móvil ya no aparece en tu ámbito actual. No se ha vuelto a modificar su permiso.');
  }catch(error){
   let message=confirmed?'El servidor confirmó la revocación, pero no se ha podido actualizar la lista.':auditorAdminError(error);
   try{
    const current=await readRows();const found=current.find(row=>row.user_id===selected.user_id);
    if(found?.active===false)message='Comprobado con el servidor: este móvil está inactivo. No hace falta repetir la revocación. Los trabajos guardados se conservan.';
    else if(found?.active===true)message+=' El servidor muestra este móvil activo.';
    else message+=' El móvil no aparece en tu ámbito actual; no se puede comprobar aquí su estado.';
   }catch{setStale(true);message+=' No se ha podido comprobar el estado actual. Actualiza la lista cuando vuelva la conexión.';}
   setNotice(message);
  }finally{setTarget(null);inFlight.current=false;setBusy(false);}
 }
 return <section className={compact?'admin-header-tool':'card'}>
  <button className="secondary" onClick={load} disabled={busy}>Móviles auditores</button>
  {open&&<div className="admin-header-tool-content"><h3>Móviles auditores activos</h3>
   <p>Se muestran solo los móviles activos. Comprueba la referencia del móvil antes de revocar un permiso. Revocar un móvil no elimina sus auditorías ni sus consumos enviados.</p>
   <p className="muted">Última autorización: día y hora del último permiso registrado para este móvil, en hora local peninsular. Abrir la aplicación no cambia esta fecha.</p>
   <button className="secondary" disabled={busy} onClick={load}>{busy?'Comprobando...':'Actualizar lista'}</button>
   {stale&&<p role="status">Lista pendiente de verificar. Actualízala antes de revocar un permiso.</p>}
   {rows.length?<div style={{overflowX:'auto'}}><table><thead><tr><th>Nombre y apellidos</th><th>Última autorización</th><th>Lote / zona</th><th>Almacén</th><th>Estado</th><th>Acceso</th></tr></thead><tbody>
    {rows.map(row=><tr key={row.user_id}><td>{row.full_name}<small style={{display:'block'}}>Móvil {row.user_id.slice(0,8)}</small></td><td style={{whiteSpace:'nowrap'}}>{auditorRegistrationLabel(auditorLastAuthorization(row))}</td><td>{row.lot} · {row.zone}</td><td>{row.warehouse_name}</td><td>Activo</td><td><button disabled={busy||stale} className="danger" onClick={()=>requestRevoke(row)}>Revocar</button></td></tr>)}
   </tbody></table></div>:!busy&&!stale&&<p>No hay móviles auditores activos en tu ámbito.</p>}
   <button className="secondary" disabled={busy} onClick={()=>setOpen(false)}>Cerrar</button>
  </div>}
  {(target||notice)&&<AuditorAccessDialog target={target} notice={notice} busy={busy} onCancel={cancelDialog} onConfirm={revoke}/>}
 </section>;
}
