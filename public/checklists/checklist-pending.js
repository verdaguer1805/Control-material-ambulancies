import {svbGuardStatus} from './svb-guard-window.js?v=288';

export const CHECKLIST_PENDING_PREFIX = 'cma_checklist_pending_v1:';
export const CHECKLIST_PENDING_EVENT = 'cma:checklist-pending-changed';
const fields = ['lot','zone','unit','type','guardCode','vehicle'];
export function checklistPendingKey(scope) {
  if(fields.some(field=>typeof scope?.[field]!=='string'||!scope[field].trim()))throw new Error('INVALID_CHECKLIST_PENDING_SCOPE');
  return CHECKLIST_PENDING_PREFIX+JSON.stringify(fields.map(field=>scope[field]));
}
const changed=()=>{if(typeof window!=='undefined')window.dispatchEvent(new Event(CHECKLIST_PENDING_EVENT));};
export function readChecklistPending(storage,scope) {
  const key=checklistPendingKey(scope),raw=storage.getItem(key);
  if(raw===null)return null;
  try {
    const row=JSON.parse(raw);
    if(!row?.attemptId||checklistPendingKey(row)!==key)throw new Error('INVALID_PENDING');
    return row;
  } catch {return {...scope,corrupt:true,reason:'storage'};}
}
export function listChecklistPending(storage,scope) {
  const rows=[];
  for(let i=0;i<storage.length;i++){
    const key=storage.key(i);if(!key?.startsWith(CHECKLIST_PENDING_PREFIX))continue;
    let identity;
    try{
      const values=JSON.parse(key.slice(CHECKLIST_PENDING_PREFIX.length));
      if(!Array.isArray(values)||values.length!==fields.length)continue;
      identity=Object.fromEntries(fields.map((field,index)=>[field,values[index]]));
      checklistPendingKey(identity);
    }catch{continue;}
    if(['lot','zone','unit','type'].some(field=>scope[field]!==undefined&&scope[field]!==identity[field]))continue;
    const row=readChecklistPending(storage,identity);if(row)rows.push(row);
  }
  return rows.sort((a,b)=>String(a.guardStartedAt||a.firstAttemptAt||'').localeCompare(String(b.guardStartedAt||b.firstAttemptAt||'')));
}
// This is a durable warning/attempt receipt, not permission to send another guard.
// Save BEFORE HTTP so closing the app during the request cannot erase the warning.
export function beginChecklistAttempt(storage,scope,now=new Date()) {
  const previous=readChecklistPending(storage,scope);
  if(previous?.corrupt)throw new Error('CHECKLIST_PENDING_STORAGE');
  const row={...Object.fromEntries(fields.map(field=>[field,scope[field]])),guardStartedAt:scope.guardStartedAt,
    attemptId:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`,
    firstAttemptAt:previous?.firstAttemptAt||now.toISOString(),lastAttemptAt:now.toISOString(),reason:'sending'};
  storage.setItem(checklistPendingKey(scope),JSON.stringify(row));changed();return row;
}
export function failChecklistAttempt(storage,attempt,error) {
  if(!attempt||readChecklistPending(storage,attempt)?.attemptId!==attempt.attemptId)return;
  const message=String(error?.message||error||'');
  const reason=/TIMEOUT|timeout|AbortError/.test(message)?'timeout':/GUARD_EXPIRED/.test(message)?'expired':/AUTH|SESSION/.test(message)?'authorization':error instanceof TypeError||/fetch|network|connection|conexi/i.test(message)?'connection':'unknown';
  storage.setItem(checklistPendingKey(attempt),JSON.stringify({...attempt,reason}));changed();
}
export function confirmChecklistAttempt(storage,attempt,receivedAt) {
  if(!receivedAt||!Number.isFinite(Date.parse(receivedAt)))throw new Error('CHECKLIST_CONFIRMATION_MISSING');
  if(!attempt||readChecklistPending(storage,attempt)?.attemptId!==attempt.attemptId)return false;
  storage.removeItem(checklistPendingKey(attempt));changed();return true;
}
export function checklistPendingLabel(row) {
  const when=new Date(row.guardStartedAt||row.firstAttemptAt);
  const date=Number.isFinite(+when)?when.toLocaleDateString('es-ES',{timeZone:'Europe/Madrid'}):row.guardCode;
  return `${row.unit} · Vehículo ${row.vehicle} · Guardia ${date}`;
}
export function checklistPendingText(row,now=new Date()) {
  if(row.corrupt)return 'No se puede leer el aviso de envío guardado. No borres los datos de la aplicación; avisa a supervisión.';
  if(row.reason==='expired'||['SVB','BP'].includes(row.type)&&svbGuardStatus(row,now)==='expired')return 'El envío de esta guardia sigue sin confirmar y su plazo ha terminado. Las respuestas se conservan. Avisa a supervisión; no lo envíes como un checklist del turno nuevo.';
  if(row.reason==='authorization')return 'El servidor no ha confirmado el checklist. Comprueba la autorización con supervisión. Las respuestas siguen guardadas; no borres los datos de la aplicación.';
  return 'El servidor todavía no ha confirmado el checklist. Las respuestas siguen guardadas en este móvil. Con cobertura, vuelve a pulsar Enviar checklist. No borres los datos de la aplicación.';
}
export function showChecklistPendingDialog(message,detail='') {
  if(typeof document==='undefined')return()=>{};
  // One centred warning, never an accumulating stack of alerts.
  document.querySelector('dialog[data-checklist-pending]')?.remove();
  const dialog=document.createElement('dialog');dialog.dataset.checklistPending='';dialog.setAttribute('aria-label','Checklist pendiente de confirmar');
  dialog.style.cssText='position:fixed;inset:0;margin:auto;width:min(440px,calc(100% - 32px));max-height:85dvh;overflow:auto;padding:24px;border:3px solid #b45309;border-radius:18px;background:#fff;color:#16323a;text-align:center;box-sizing:border-box;font-family:Arial,sans-serif;box-shadow:0 12px 48px #0007';
  const heading=document.createElement('h2');heading.textContent='Checklist pendiente de confirmar';heading.style.marginTop='0';
  const identity=document.createElement('p');identity.textContent=detail;identity.style.fontWeight='700';
  const body=document.createElement('p');body.textContent=message;body.style.lineHeight='1.5';
  const button=document.createElement('button');button.type='button';button.textContent='Entendido';button.style.cssText='display:block;width:100%;min-height:48px;padding:12px;border:0;border-radius:12px;background:#0b5f73;color:white;font-size:17px;font-weight:800';
  const close=()=>{dialog.close();dialog.remove();};button.onclick=close;
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.append(heading,identity,body,button);document.body.append(dialog);dialog.showModal();return close;
}
export function dismissChecklistPendingDialog(){if(typeof document!=='undefined')document.querySelector('dialog[data-checklist-pending]')?.remove();}
