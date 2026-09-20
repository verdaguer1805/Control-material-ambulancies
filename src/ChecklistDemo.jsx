import React, { useEffect, useRef, useState } from "react";
import { DEMO_ITEMS, TSNU_CHECKLIST_GROUPS, VEHICLE_TYPES, demoKey, completeDemo, closeDemoShift, readDemo, saveDemo, filterDemo } from "./checklist-demo.mjs";
import { ensureAnonymousSession, supabase } from "./supabase.js";
import { newOperationId, queueTsnuOperation, readTsnuOutbox, readTsnuShift, saveTsnuShift, rpcForTsnuOperation, syncTsnuOutbox, removeTsnuShiftOperations } from "./tsnu-outbox.mjs";
import "./checklist-demo.css";

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
function Modal({ title, children, close, footer }) {
  useEffect(() => { const fn = (e) => { if(e.key === "Escape") close(); }; document.addEventListener("keydown", fn); return () => document.removeEventListener("keydown", fn); }, [close]);
  return <div className="modal-backdrop checklist-backdrop"><section className="card checklist-modal" role="dialog" aria-modal="true" aria-label={title}>
    <header><h2>{title}</h2><button autoFocus className="secondary" aria-label="Cerrar checklist" onClick={close}>×</button></header>
    <div className="checklist-body">{children}</div><footer>{footer}<button className="secondary" onClick={close}>Cerrar</button></footer>
  </section></div>;
}
export default function ChecklistDemo({ unit, lot, zone, warehouse, shift, reportsOnly = false, assignedChecklist = "", production = false, materials = DEMO_ITEMS }) {
  const [date, setDate] = useState(today), [phase, setPhase] = useState("open"), [open,setOpen] = useState(false), [report,setReport] = useState(false);
  const [draft,setDraft] = useState(null), [notice,setNotice] = useState(""), [busy,setBusy] = useState(false), [rows,setRows] = useState([]);
  const [activeShift,setActiveShift] = useState(null), [material,setMaterial] = useState({}), [closeOpen,setCloseOpen] = useState(false);
  const [vehicleType,setVehicleType] = useState("TSU"), [materialSearch,setMaterialSearch]=useState(""), [syncing,setSyncing]=useState(false);
  const [recoveryShiftId,setRecoveryShiftId]=useState(""), [recoveryOpen,setRecoveryOpen]=useState(false), [recoveryPin,setRecoveryPin]=useState("");
  const syncLock=useRef(false);
  const daily = (assignedChecklist || vehicleType) === "TSNU";
  const [from,setFrom] = useState(today), [to,setTo] = useState(today), [zoneFilter,setZoneFilter] = useState(""), [warehouseFilter,setWarehouseFilter] = useState(""), [lotFilter,setLotFilter] = useState("");
  useEffect(() => { if(!notice) return; const timer=setTimeout(()=>setNotice(""),4000); return ()=>clearTimeout(timer); },[notice]);
  useEffect(()=>{if(!production||!daily)return;setActiveShift(readTsnuShift(localStorage,unit,lot));const online=()=>void syncProduction();window.addEventListener('online',online);void syncProduction();return()=>window.removeEventListener('online',online);},[production,daily,unit,lot]);
  async function syncProduction(showResult=false){
    if(!production||syncLock.current)return;syncLock.current=true;setSyncing(true);
    try{await ensureAnonymousSession();const result=await syncTsnuOutbox(localStorage,async operation=>{const [name,args]=rpcForTsnuOperation(operation);const {error}=await supabase.rpc(name,args);if(error)throw error;});const failedShift=result.failed[0]?.operation?.shiftId||"";setRecoveryShiftId(failedShift);if(showResult)setNotice(result.synced.length?`Pendientes sincronizados correctamente (${result.synced.length})`:result.failed.length?"Hay una sesión pendiente de revisión. Las demás pueden continuar":"No hay registros pendientes");return !result.stopped;}
    catch{if(showResult)setNotice("Sin cobertura: los registros continúan guardados en este dispositivo");return false;}finally{syncLock.current=false;setSyncing(false);}
  }
  function start() {
    try {
      const sessionId = daily ? `${Date.now()}-${Math.random().toString(36).slice(2)}` : undefined;
      const identity = { unit,lot,zone,warehouse,date,service: daily ? "TSNU" : "TSU",vehicleType: assignedChecklist || vehicleType,shift: daily ? "" : shift || "07:00",sessionId,startedAt:new Date().toISOString() };
      if(production&&daily){const id=newOperationId(),next={...identity,sessionId:id,id,answers:{},completed:false};queueTsnuOperation(localStorage,{localId:`start:${id}`,type:'start',shiftId:id,at:next.startedAt});saveTsnuShift(localStorage,next);setDraft(next);setOpen(true);void syncProduction();return;}
      const existing = daily ? null : readDemo(localStorage).find((r) => demoKey(r) === demoKey(identity));
      const next = { answers: {}, notes: {}, completed:false, ...existing, ...identity, phase: daily ? "open" : phase };
      saveDemo(localStorage,next);
      if(!daily && phase === "closed") { setNotice("Ya no se puede realizar el checklist. Solo tienes dos horas desde el inicio de la guardia. (Prueba fuera de plazo)"); return; }
      setDraft(next); setOpen(true);
    } catch(e) { setNotice(e.message || "No se ha podido guardar la prueba local."); }
  }
  function edit(item,field,value) {
    const next = {...draft, completed:false, [field]:{...draft[field],[item]:value}};
    setDraft(next);
    try { if(production) saveTsnuShift(localStorage,next); else saveDemo(localStorage,next); } catch { setNotice("No se ha podido guardar el borrador en este navegador."); }
  }
  function finish() {
    try { const result=completeDemo(draft); if(production){queueTsnuOperation(localStorage,{localId:`checklist:${result.sessionId}`,type:'checklist',shiftId:result.sessionId,answers:result.answers});saveTsnuShift(localStorage,result);void syncProduction();}else saveDemo(localStorage,result); setActiveShift(result); setMaterial({}); setOpen(false); setNotice("Checklist enviado correctamente"); }
    catch(e) { setNotice(e.message || "No se ha podido guardar la prueba."); }
  }
  function sendMaterial() {
    if (!Object.values(material).some(Number)) return setNotice("Selecciona algún material antes de enviarlo");
    if(production){const selected=Object.fromEntries(Object.entries(material).filter(([,n])=>Number(n)>0)),operationId=newOperationId();queueTsnuOperation(localStorage,{localId:`withdrawal:${operationId}`,type:'withdrawal',operationId,shiftId:activeShift.sessionId,materials:selected});setMaterial({});void syncProduction();setNotice("Consumo guardado. Se sincronizará automáticamente");return;}
    setMaterial({}); setNotice("Consumo enviado correctamente (simulación local)");
  }
  function finishShift() {
    try { const result=closeDemoShift(activeShift,Object.values(material).some(Number)); if(production){queueTsnuOperation(localStorage,{localId:`finish:${result.sessionId}`,type:'finish',shiftId:result.sessionId,at:result.endedAt});saveTsnuShift(localStorage,null);void syncProduction();}else saveDemo(localStorage,result); setActiveShift(null); setCloseOpen(false); setMaterial({}); setNotice("Guardia finalizada correctamente"); }
    catch(e) { setCloseOpen(false); setNotice(e.message); }
  }
  async function recoverTsnuShift() {
    if(!recoveryShiftId||!recoveryPin)return;
    setSyncing(true);
    try{
      await ensureAnonymousSession();
      const {error}=await supabase.rpc('recover_my_tsnu_session',{p_admin_pin:recoveryPin,p_shift_id:recoveryShiftId});
      if(error)throw error;
      removeTsnuShiftOperations(localStorage,recoveryShiftId);
      if(activeShift?.sessionId===recoveryShiftId){saveTsnuShift(localStorage,null);setActiveShift(null);setMaterial({});}
      setRecoveryPin("");setRecoveryOpen(false);setRecoveryShiftId("");
      setNotice("Sesión recuperada. Los movimientos ya confirmados se conservan y el dispositivo puede continuar.");
      setTimeout(()=>void syncProduction(),0);
    }catch(error){setNotice(/ADMIN_PIN_REQUIRED/.test(String(error?.message||error))?"PIN de supervisión incorrecto":"No se ha podido recuperar la sesión. No se ha borrado ningún pendiente.");}
    finally{setSyncing(false);}
  }
  function showReport() {
    try { setRows(readDemo(localStorage)); setReport(true); } catch(e) { setNotice(e.message); }
  }
  async function download() {
    setBusy(true);
    try {
      const selected = filterDemo(readDemo(localStorage),{lot:lotFilter,zone:zoneFilter,warehouse:warehouseFilter,from,to});
      if(!selected.length) throw new Error("No hay pruebas para estas fechas y filtros en este navegador.");
      const { downloadChecklistDemo } = await import("./checklist-demo-export.mjs");
      await downloadChecklistDemo(selected);
    } catch(e) { setNotice(e.message || "No se ha podido generar el Excel de prueba."); }
    finally {setBusy(false);}
  }
  const options = (field, records=rows) => [...new Set(records.map(r=>r[field]))].sort();
  return <div className="checklist-demo">
    {reportsOnly ? <button className="secondary" onClick={showReport}>Checklist · informes de prueba</button> : <div className="card checklist-demo-card">
      {!daily || !activeShift ? <button className="checklist-yellow" onClick={start}>{daily ? `Iniciar guardia y realizar checklist${production?'':' · PRUEBA'}` : "Checklist de material · PRUEBA"}</button> : <div className="checklist-active-banner">✓ Checklist enviado · Guardia activa</div>}
      <p>{production ? `Almacén asignado: ${warehouse}. Los consumos enviados actualizan el stock.` : "Solo simulación. No afecta al consumo ni al stock."}</p>
      {assignedChecklist ? <p><strong>Checklist asignado: {assignedChecklist === "TSU" ? "SVB" : assignedChecklist}</strong> · Solo la administración cambia la asignación.</p> : <label>Tipo de vehículo / checklist de prueba<select value={vehicleType} onChange={e=>setVehicleType(e.target.value)}>{VEHICLE_TYPES.map(v=><option key={v} value={v}>{v === "TSU" ? "SVB" : v}</option>)}</select></label>}
      {!production&&<small>Los cuatro tipos usan ejemplos provisionales. La asignación real queda reservada a supervisión.</small>}
      {!production&&<div className="checklist-controls"><label>{daily ? "Fecha del checklist de prueba" : "Fecha de guardia de prueba"}<input type="date" value={date} onChange={e=>setDate(e.target.value)} /></label>
      {!daily && <label>Reloj de prueba<select value={phase} onChange={e=>setPhase(e.target.value)}><option value="open">Dentro de las dos primeras horas</option><option value="closed">Fuera de plazo (dos horas o más)</option></select></label>}</div>}
      {daily ? <small>TSNU: cada nueva tripulación inicia una guardia y realiza su propio checklist, aunque sea el mismo día.</small> : <small>Inicio asignado: {shift || "07:00"}. Puedes probar cualquier horario sin cambiar la guardia real.</small>}
      {!production&&<button className="secondary" onClick={showReport}>Ver informes de prueba</button>}
      {daily && activeShift && <section className="checklist-material-demo"><h3>Material retirado</h3><p className="muted small">Disponible después de enviar el checklist.</p><label>Buscar material<input value={materialSearch} onChange={e=>setMaterialSearch(e.target.value)} placeholder="Escribe el nombre..."/></label>{materials.filter(item=>item.toLowerCase().includes(materialSearch.toLowerCase())).map(item=><div className={`material${(material[item]||0)>0?' material-selected':''}`} key={item}><span>{item}</span><div className="counter"><button onClick={()=>setMaterial(v=>({...v,[item]:Math.max(0,(v[item]||0)-1)}))}>-</button><span className="qty">{material[item]||0}</span><button onClick={()=>setMaterial(v=>({...v,[item]:(v[item]||0)+1}))}>+</button></div></div>)}<div className="tsnu-shift-actions"><button className="primary full" onClick={sendMaterial}>Enviar consumo</button><button className="secondary full sync-button" onClick={()=>syncProduction(true)} disabled={!production||syncing}>{syncing?'Sincronizando...':`Sincronizar pendientes (${production?readTsnuOutbox(localStorage).length:0})`}</button><button className="danger full" onClick={()=>setCloseOpen(true)}>Finalizar guardia</button></div></section>}
      {production&&daily&&recoveryShiftId&&<button className="danger full" onClick={()=>setRecoveryOpen(true)}>Recuperación supervisada de sesión</button>}
    </div>}
    {open && draft && <Modal title={`Checklist de material${production?'':' · PRUEBA'}`} close={()=>setOpen(false)} footer={<button className="primary" onClick={finish}>{production?'Enviar checklist':'Guardar checklist de prueba'}</button>}>
      <p><strong>{unit} · {date} · {draft.vehicleType === "TSU" ? "SVB" : draft.vehicleType}</strong><br/>{production?'Comprueba todos los elementos antes de enviar.':'Lista provisional de prueba.'}</p>
      {(daily ? TSNU_CHECKLIST_GROUPS : [["Material",DEMO_ITEMS]]).map(([group,items])=><section key={group}><h3 className="checklist-group-title">{group}</h3>{items.map(item=><div className={`checklist-item ${draft.answers[item]==='ok'?'checklist-row-ok':draft.answers[item]==='issue'?'checklist-row-issue':''}`} key={item}><strong>{item}</strong><div className="checklist-choices">
        <button title="Correcto" aria-label={`${item}: correcto`} aria-pressed={draft.answers[item]==="ok"} className={draft.answers[item]==="ok"?"checklist-ok":"checklist-ok checklist-unselected"} onClick={()=>edit(item,"answers","ok")}>✓</button>
        <button title="Incidencia" aria-label={`${item}: incidencia`} aria-pressed={draft.answers[item]==="issue"} className={draft.answers[item]==="issue"?"checklist-issue":"checklist-issue checklist-unselected"} onClick={()=>edit(item,"answers","issue")}>✕</button>
      </div></div>)}</section>)}
    </Modal>}
    {closeOpen && <Modal title="Finalizar guardia" close={()=>setCloseOpen(false)} footer={<button className="danger" onClick={finishShift}>Finalizar guardia</button>}><p>¿Seguro que quieres finalizar la guardia? Después deberás iniciar una nueva guardia y realizar otro checklist.</p>{Object.values(material).some(Number)&&<p className="checklist-pending-warning">Hay material seleccionado pendiente de enviar.</p>}</Modal>}
    {recoveryOpen&&<Modal title="Recuperación supervisada" close={()=>{setRecoveryOpen(false);setRecoveryPin("");}} footer={<button className="danger" disabled={syncing||!recoveryPin} onClick={recoverTsnuShift}>{syncing?"Recuperando...":"Confirmar recuperación"}</button>}><p>Solo se aislará la sesión TSNU con error. Los movimientos ya confirmados en Supabase, las demás sesiones y las demás unidades se conservarán.</p><label>PIN de supervisión<input type="password" inputMode="numeric" autoComplete="new-password" value={recoveryPin} onChange={e=>setRecoveryPin(e.target.value.replace(/\D/g,"").slice(0,12))}/></label></Modal>}
    {report && <Modal title="Informes de checklist · PRUEBA" close={()=>setReport(false)} footer={<button className="primary" disabled={busy} onClick={download}>{busy?"Preparando...":"Descargar Excel de prueba"}</button>}>
      <p>Solo pruebas guardadas en este navegador. No incluye las unidades reales ni sincroniza entre dispositivos.</p>
      <p>TSNU: una revisión por fecha, sin horario de guardia. Una fecha pasada sin completar figura como no realizada; durante el día sigue pendiente.</p>
      <p>Verde: completo correcto. Naranja: completo con incidencia. Rojo: prueba fuera de plazo sin completar. Gris: pendiente. Solo se incluyen las guardias de prueba que hayas abierto.</p>
      <label>Lote<select value={lotFilter} onChange={e=>{setLotFilter(e.target.value);setZoneFilter("");setWarehouseFilter("");}}><option value="">Todos los lotes de prueba</option>{options("lot").map(v=><option key={v}>{v}</option>)}</select></label>
      <label>Supervisión<select value={zoneFilter} onChange={e=>{setZoneFilter(e.target.value);setWarehouseFilter("");}}><option value="">Todas las zonas de prueba</option>{options("zone",rows.filter(r=>!lotFilter||r.lot===lotFilter)).map(v=><option key={v}>{v}</option>)}</select></label>
      <label>Almacén<select value={warehouseFilter} onChange={e=>setWarehouseFilter(e.target.value)}><option value="">Todos los almacenes de prueba</option>{options("warehouse",rows.filter(r=>(!lotFilter||r.lot===lotFilter)&&(!zoneFilter||r.zone===zoneFilter))).map(v=><option key={v}>{v}</option>)}</select></label>
      <label>Desde<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Hasta<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
    </Modal>}
    {notice && <div className="modal-backdrop checklist-notice"><div className="card" role="alert"><h2>Aviso</h2><p>{notice}</p><button className="secondary" onClick={()=>setNotice("")}>Cerrar</button></div></div>}
  </div>;
}
