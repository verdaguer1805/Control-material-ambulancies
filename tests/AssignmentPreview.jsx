import React, {useState} from 'react';
import ChecklistDemo from '../src/ChecklistDemo.jsx';
import {LOTS} from '../src/data.js';
import {TSNU_UNITS} from '../src/unit-checklist-config.mjs';
import {ASSIGNMENT_DEMO_KEY,CHECKLIST_OPTIONS,resolveDemoAssignment,assignDemo} from '../src/checklist-assignment-demo.mjs';
import '../src/styles.css';
import '../src/overrides.css';

const LOT=Object.keys(LOTS)[0];
const initial={lot:LOT,zone:'Olot',unit:'G453',warehouse:'Camprodon',shift:'07:00'};
export default function AssignmentPreview(){
 const [saved,setSaved]=useState(()=>{try{const raw=localStorage.getItem(ASSIGNMENT_DEMO_KEY);return resolveDemoAssignment(raw?JSON.parse(raw):initial);}catch{return resolveDemoAssignment(initial);}});
 const [admin,setAdmin]=useState(false),[draft,setDraft]=useState(saved),[error,setError]=useState(''),[amount,setAmount]=useState(0),[msg,setMsg]=useState('');
 function configure(){setDraft(saved);setError('');setAdmin(true);}
 const units=draft.service==='TSNU'?Object.fromEntries(Object.keys(TSNU_UNITS[draft.lot]?.[draft.zone] || {}).map(u=>[u,['K1376','K1377','T1731','T1732','T1733','T1734','T1735','T1736'].includes(u)?'Campdevànol':'Almacén central de Olot'])):Object.fromEntries(Object.entries(LOTS[draft.lot]?.[draft.zone] || {}).filter(([u,base])=>!u.startsWith('SUPERVISOR_')&&!/^Material supervisor/i.test(base)));
 function commit(){try{const next=assignDemo(draft);localStorage.setItem(ASSIGNMENT_DEMO_KEY,JSON.stringify(next));setSaved(next);setAdmin(false);setAmount(0);setMsg('Asignación local guardada. Ningún dispositivo real ha cambiado.');}catch(e){setError(e.message);}}
 function legacy(){setSaved(resolveDemoAssignment(initial));setAmount(0);setMsg('Simulación de móvil ya asignado: conserva unidad, zona y horario. TSU por defecto; checklist pendiente.');}
 return <div className="app"><header className="header"><div><h1>Control de material · DEMOSTRACIÓN LOCAL</h1><strong>{saved.unit} · {saved.service}</strong><p>{saved.zone} · {saved.warehouse} · {saved.service==='TSNU' ? 'Checklist por fecha, sin horario' : `Inicio ${saved.shift}`}</p></div></header>
 <main className="container">
  <div className="card"><strong>Panel de pruebas (no aparece en los móviles reales)</strong><p>Solo este navegador. No conecta con Supabase ni cambia las asignaciones operativas.</p>
   <div className="toolbar"><button className="secondary" onClick={configure}>Administración: asignar unidad y checklist</button><button className="secondary" onClick={legacy}>Probar móvil ya asignado</button></div>
   <ChecklistDemo reportsOnly />
  </div>
  {msg&&<p role="status">{msg}</p>}
  {saved.checklist ? <ChecklistDemo key={JSON.stringify(saved)} unit={saved.unit} lot={saved.lot} zone={saved.zone} warehouse={saved.warehouse} shift={saved.shift} assignedChecklist={saved.checklist}/> : <div className="card"><strong>Checklist pendiente de asignar por administración.</strong><p>Los consumos siguen disponibles para esta TSU. No hace falta volver a asignar el móvil.</p></div>}
  {saved.canConsume&&<section className="card"><h2>Consumo de guardia · SIMULADO</h2><p>Ejemplo para comprobar que TSU conserva consumos. No es el formulario operativo.</p><label>Gasas (cantidad de ejemplo)<input type="number" min="0" value={amount} onChange={e=>setAmount(Math.max(0,Number(e.target.value)))}/></label><button className="primary" onClick={()=>{setAmount(0);setMsg('Consumo simulado. No se ha enviado ni descontado material.');}}>Simular envío de consumo</button></section>}
  {admin&&<div className="modal-backdrop checklist-backdrop"><section className="card checklist-modal" role="dialog" aria-modal="true" aria-label="Asignación local"><header><h2>Asignación local</h2><button className="secondary" onClick={()=>setAdmin(false)}>Cerrar</button></header><div className="checklist-body">
   <p>No pide códigos reales. Simula la configuración que hará administración.</p>
   <label>Lote<select value={draft.lot} onChange={e=>setDraft({...draft,lot:e.target.value,zone:'',unit:'',warehouse:''})}>{Object.keys(LOTS).map(v=><option key={v}>{v}</option>)}</select></label>
   <label>Supervisión<select value={draft.zone} onChange={e=>setDraft({...draft,zone:e.target.value,unit:'',warehouse:''})}><option value="">Selecciona zona</option>{Object.keys(LOTS[draft.lot]||{}).sort().map(v=><option key={v}>{v}</option>)}</select></label>
   <label>Tipo de servicio<select value={draft.service} onChange={e=>setDraft({...draft,service:e.target.value,unit:'',warehouse:'',checklist:e.target.value==='TSNU'?'TSNU':''})}><option>TSU</option><option>TSNU</option></select></label>
   {draft.service==='TSNU'&&<p>Prueba con las unidades TSNU de Olot y su almacén asignado. No cambia ninguna asignación real.</p>}
   <label>Unidad<select value={draft.unit} onChange={e=>setDraft({...draft,unit:e.target.value,warehouse:units[e.target.value]||''})}><option value="">Selecciona unidad</option>{Object.entries(units).map(([u,base])=><option key={u} value={u}>{u} · {base}</option>)}</select></label>
   <label>Checklist asignado<select value={draft.checklist} disabled={draft.service==='TSNU'} onChange={e=>setDraft({...draft,checklist:e.target.value})}><option value="">Selecciona checklist</option>{CHECKLIST_OPTIONS[draft.service].map(v=><option key={v} value={v}>{v==='TSU'?'SVB':v}</option>)}</select></label>
   <p>TSU: tres opciones (nombres provisionales). TSNU: su único checklist. Listas oficiales pendientes.</p>
   {draft.service==='TSU' ? <label>Inicio de guardia<select value={draft.shift || ''} onChange={e=>setDraft({...draft,shift:e.target.value})}><option value="">Selecciona horario</option>{['07:00','08:00','09:00'].map(v=><option key={v}>{v}</option>)}</select></label> : <p>TSNU: no se pide horario. El checklist se registra por fecha y puede hacerse a cualquier hora.</p>}
   {error&&<p role="alert">{error}</p>}
  </div><footer><button className="primary" onClick={commit}>Guardar asignación local</button><button className="secondary" onClick={()=>setAdmin(false)}>Cancelar</button></footer></section></div>}
 </main></div>;
}
