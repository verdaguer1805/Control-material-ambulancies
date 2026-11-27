import React,{useEffect,useState} from 'react';
import {CHECKLIST_PENDING_EVENT,listChecklistPending,checklistPendingLabel,checklistPendingText,showChecklistPendingDialog,dismissChecklistPendingDialog} from '../public/checklists/checklist-pending.js';

export default function ChecklistPendingNotice({lot,zone,unit,type}){
 const read=()=>listChecklistPending(localStorage,{lot,zone,unit,type});
 const [rows,setRows]=useState(read);
 useEffect(()=>{
  const initial=read();setRows(initial);
  const close=initial.length?showChecklistPendingDialog(checklistPendingText(initial[0]),checklistPendingLabel(initial[0])):null;
  const refresh=()=>{const next=read();setRows(next);if(!next.length)dismissChecklistPendingDialog();};
  window.addEventListener(CHECKLIST_PENDING_EVENT,refresh);window.addEventListener('storage',refresh);window.addEventListener('focus',refresh);
  document.addEventListener('visibilitychange',refresh);
  return()=>{close?.();window.removeEventListener(CHECKLIST_PENDING_EVENT,refresh);window.removeEventListener('storage',refresh);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[lot,zone,unit,type]);
 if(!rows.length)return null;
 return <section className="card" role="alert" data-checklist-pending-banner style={{border:'2px solid #b45309',background:'#fff7e6',color:'#713f12'}}>
  <strong>⚠ Checklist pendiente de confirmar{rows.length>1?` (${rows.length})`:''}</strong>
  {rows.map(row=><div key={`${row.type}:${row.guardCode}:${row.vehicle}`}><p><strong>{checklistPendingLabel(row)}</strong></p><p>{checklistPendingText(row)}</p></div>)}
 </section>;
}
