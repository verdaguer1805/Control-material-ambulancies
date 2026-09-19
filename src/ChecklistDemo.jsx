import React, { useEffect, useState } from "react";
import { DEMO_ITEMS, TSNU_CHECKLIST_GROUPS, VEHICLE_TYPES, demoKey, completeDemo, closeDemoShift, readDemo, saveDemo, filterDemo } from "./checklist-demo.mjs";
import "./checklist-demo.css";

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
function Modal({ title, children, close, footer }) {
  useEffect(() => { const fn = (e) => { if(e.key === "Escape") close(); }; document.addEventListener("keydown", fn); return () => document.removeEventListener("keydown", fn); }, [close]);
  return <div className="modal-backdrop checklist-backdrop"><section className="card checklist-modal" role="dialog" aria-modal="true" aria-label={title}>
    <header><h2>{title}</h2><button autoFocus className="secondary" aria-label="Cerrar checklist" onClick={close}>×</button></header>
    <div className="checklist-body">{children}</div><footer>{footer}<button className="secondary" onClick={close}>Cerrar</button></footer>
  </section></div>;
}
export default function ChecklistDemo({ unit, lot, zone, warehouse, shift, reportsOnly = false, assignedChecklist = "" }) {
  const [date, setDate] = useState(today), [phase, setPhase] = useState("open"), [open,setOpen] = useState(false), [report,setReport] = useState(false);
  const [draft,setDraft] = useState(null), [notice,setNotice] = useState(""), [busy,setBusy] = useState(false), [rows,setRows] = useState([]);
  const [activeShift,setActiveShift] = useState(null), [material,setMaterial] = useState({}), [closeOpen,setCloseOpen] = useState(false);
  const [vehicleType,setVehicleType] = useState("TSU");
  const daily = (assignedChecklist || vehicleType) === "TSNU";
  const [from,setFrom] = useState(today), [to,setTo] = useState(today), [zoneFilter,setZoneFilter] = useState(""), [warehouseFilter,setWarehouseFilter] = useState(""), [lotFilter,setLotFilter] = useState("");
  useEffect(() => { if(!notice) return; const timer=setTimeout(()=>setNotice(""),4000); return ()=>clearTimeout(timer); },[notice]);
  function start() {
    try {
      const sessionId = daily ? `${Date.now()}-${Math.random().toString(36).slice(2)}` : undefined;
      const identity = { unit,lot,zone,warehouse,date,service: daily ? "TSNU" : "TSU",vehicleType: assignedChecklist || vehicleType,shift: daily ? "" : shift || "07:00",sessionId,startedAt:new Date().toISOString() };
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
    try { saveDemo(localStorage,next); } catch { setNotice("No se ha podido guardar el borrador en este navegador."); }
  }
  function finish() {
    try { const result=completeDemo(draft); saveDemo(localStorage,result); setActiveShift(result); setMaterial({}); setOpen(false); setNotice("Checklist enviado correctamente"); }
    catch(e) { setNotice(e.message || "No se ha podido guardar la prueba."); }
  }
  function sendMaterial() {
    if (!Object.values(material).some(Number)) return setNotice("Selecciona algún material antes de enviarlo");
    setMaterial({}); setNotice("Consumo enviado correctamente (simulación local)");
  }
  function finishShift() {
    try { const result=closeDemoShift(activeShift,Object.values(material).some(Number)); saveDemo(localStorage,result); setActiveShift(null); setCloseOpen(false); setMaterial({}); setNotice("Guardia finalizada correctamente"); }
    catch(e) { setCloseOpen(false); setNotice(e.message); }
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
      {!daily || !activeShift ? <button className="checklist-yellow" onClick={start}>{daily ? "Iniciar guardia y realizar checklist · PRUEBA" : "Checklist de material · PRUEBA"}</button> : <div className="checklist-active-banner">✓ Checklist enviado · Guardia activa</div>}
      <p>Solo simulación. Lista provisional, sin cantidades oficiales. No afecta al consumo ni al stock.</p>
      {assignedChecklist ? <p><strong>Checklist asignado: {assignedChecklist === "TSU" ? "SVB" : assignedChecklist}</strong> · Solo la administración cambia la asignación.</p> : <label>Tipo de vehículo / checklist de prueba<select value={vehicleType} onChange={e=>setVehicleType(e.target.value)}>{VEHICLE_TYPES.map(v=><option key={v} value={v}>{v === "TSU" ? "SVB" : v}</option>)}</select></label>}
      <small>Los cuatro tipos usan ejemplos provisionales hasta recibir sus listas oficiales. La asignación real quedará reservada a supervisión.</small>
      <div className="checklist-controls"><label>{daily ? "Fecha del checklist de prueba" : "Fecha de guardia de prueba"}<input type="date" value={date} onChange={e=>setDate(e.target.value)} /></label>
      {!daily && <label>Reloj de prueba<select value={phase} onChange={e=>setPhase(e.target.value)}><option value="open">Dentro de las dos primeras horas</option><option value="closed">Fuera de plazo (dos horas o más)</option></select></label>}</div>
      {daily ? <small>TSNU: cada nueva tripulación inicia una guardia y realiza su propio checklist, aunque sea el mismo día.</small> : <small>Inicio asignado: {shift || "07:00"}. Puedes probar cualquier horario sin cambiar la guardia real.</small>}
      <button className="secondary" onClick={showReport}>Ver informes de prueba</button>
      {daily && activeShift && <section className="checklist-material-demo"><h3>Material retirado</h3><p className="muted small">Disponible después de enviar el checklist. Esta prueba no modifica existencias.</p>{DEMO_ITEMS.map(item=><div className={`material${(material[item]||0)>0?' material-selected':''}`} key={item}><span>{item}</span><div className="counter"><button onClick={()=>setMaterial(v=>({...v,[item]:Math.max(0,(v[item]||0)-1)}))}>-</button><span className="qty">{material[item]||0}</span><button onClick={()=>setMaterial(v=>({...v,[item]:(v[item]||0)+1}))}>+</button></div></div>)}<div className="tsnu-shift-actions"><button className="primary full" onClick={sendMaterial}>Enviar consumo</button><button className="secondary full sync-button" disabled>Sincronizar pendientes (0)</button><button className="danger full" onClick={()=>setCloseOpen(true)}>Finalizar guardia</button></div></section>}
    </div>}
    {open && draft && <Modal title="Checklist de material · PRUEBA" close={()=>setOpen(false)} footer={<button className="primary" onClick={finish}>Guardar checklist de prueba</button>}>
      <p><strong>{unit} · {date} · {draft.vehicleType === "TSU" ? "SVB" : draft.vehicleType}</strong><br/>Lista provisional: comprueba cada elemento. No es una dotación oficial.</p>
      {(daily ? TSNU_CHECKLIST_GROUPS : [["Material",DEMO_ITEMS]]).map(([group,items])=><section key={group}><h3 className="checklist-group-title">{group}</h3>{items.map(item=><div className="checklist-item" key={item}><strong>{item}</strong><div className="checklist-choices">
        <button aria-pressed={draft.answers[item]==="ok"} className={draft.answers[item]==="ok"?"checklist-ok":"secondary"} onClick={()=>edit(item,"answers","ok")}>✓ Correcto</button>
        <button aria-pressed={draft.answers[item]==="issue"} className={draft.answers[item]==="issue"?"checklist-issue":"secondary"} onClick={()=>edit(item,"answers","issue")}>✕ Incidencia</button>
      </div></div>)}</section>)}
    </Modal>}
    {closeOpen && <Modal title="Finalizar guardia" close={()=>setCloseOpen(false)} footer={<button className="danger" onClick={finishShift}>Finalizar guardia</button>}><p>¿Seguro que quieres finalizar la guardia? Después deberás iniciar una nueva guardia y realizar otro checklist.</p>{Object.values(material).some(Number)&&<p className="checklist-pending-warning">Hay material seleccionado pendiente de enviar.</p>}</Modal>}
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
