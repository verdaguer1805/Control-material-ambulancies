import React,{useEffect,useState} from 'react';
import {releaseFromWorker,freshAppUrl,pendingAuditUpdate} from './app-update.mjs';
export default function AppUpdateNotice({version}){
 const [latest,setLatest]=useState(0),[pending,setPending]=useState(()=>pendingAuditUpdate(localStorage)),[recovery,setRecovery]=useState(false),[confirmed,setConfirmed]=useState(false),[collapsed,setCollapsed]=useState(false);
 useEffect(()=>{if(!latest)return;setCollapsed(false);const timer=setInterval(()=>{if(!document.hidden)setPending(pendingAuditUpdate(localStorage));},1000);return()=>clearInterval(timer);},[latest]);
 function update(recover=false){
  const state=pendingAuditUpdate(localStorage);setPending(state);
  if(state.blocked&&!(recover&&confirmed))return;
  location.replace(freshAppUrl(location.href,latest));
 }
 useEffect(()=>{
  let stopped=false,running=false,last=0;
  async function check(){
   if(stopped||running||document.hidden||navigator.onLine===false||Date.now()-last<30000)return;
   running=true;last=Date.now();const controller=new AbortController();
   const timer=setTimeout(()=>controller.abort(),8000);
   try{
    const response=await fetch(new URL('./sw.js',location.href),{cache:'no-store',signal:controller.signal});
    if(response.ok){const found=releaseFromWorker(await response.text());if(!stopped&&found>Number(String(version).replace(/^v/,'')))setLatest(found);}
    const registration=await navigator.serviceWorker?.getRegistration();
    if(registration)void registration.update().catch(()=>{});
   }catch{/* A connection failure must not interrupt work. */}
   finally{clearTimeout(timer);running=false;}
  }
  void check();const timer=setInterval(check,60000);
  window.addEventListener('online',check);window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);
  return()=>{stopped=true;clearInterval(timer);window.removeEventListener('online',check);window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check);};
 },[version]);
 if(!latest)return null;
 if(collapsed)return <button type="button" className="secondary" style={{position:'fixed',right:8,top:8,zIndex:10000}} onClick={()=>setCollapsed(false)}>v{latest} disponible</button>;
 return <aside role="status" style={{position:'fixed',top:8,left:'50%',transform:'translateX(-50%)',zIndex:10000,width:'min(94vw,480px)',padding:12,background:'#fff',color:'#153b46',border:'3px solid #087b8f',borderRadius:12,boxShadow:'0 4px 20px #0005'}}>
  <strong>Actualización v{latest} disponible</strong><button type="button" className="secondary full" onClick={()=>setCollapsed(true)}>Seguir trabajando</button><p>{pending.blocked?'Tienes una auditoría pendiente. Finalízala y envíala antes de actualizar.':'Actualiza cuando hayas terminado la acción actual. No se borrarán los datos guardados en este móvil.'}</p>
  <button type="button" className="primary full" disabled={pending.blocked} onClick={()=>update()}>Actualizar aplicación</button>
  {pending.blocked&&<button type="button" className="secondary full" onClick={()=>{setRecovery(!recovery);setConfirmed(false);}}>No puedo terminar: recuperar mediante actualización</button>}
  {recovery&&pending.blocked&&<><p>Solo si un error impide continuar. Se conservarán los datos guardados; actualizar no reactiva un permiso revocado.</p><label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Un error me impide terminar la auditoría.</label><button type="button" className="primary full" disabled={!confirmed} onClick={()=>update(true)}>Actualizar para recuperar</button></>}
 </aside>;
}
