import React, { useMemo, useState } from "react";
import { SVB_LEFT_WALL_SECTIONS, sectionStatus } from "../src/svb-left-wall-data.mjs";
import "./svb-left-wall-preview.css";

const STORAGE_KEY = "cma_svb_left_wall_preview_v1";
const positions = {
  1:[17,17], 2:[18,34], 3:[19,55], 4:[20,73], 5:[21,92],
  7:[49,17], 8:[70,17], 9:[90,17]
};

function readDraft() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}

export default function SvbLeftWallPreview() {
  const [answers,setAnswers] = useState(readDraft), [selected,setSelected] = useState(null);
  const section = SVB_LEFT_WALL_SECTIONS.find((row)=>row.id===selected);
  const statuses = useMemo(()=>Object.fromEntries(SVB_LEFT_WALL_SECTIONS.map((row)=>[row.id,sectionStatus(row,answers)])),[answers]);
  const completed = Object.values(statuses).filter((value)=>value!=="pending").length;

  function mark(item,value) {
    setAnswers((current)=>{
      const next={...current,[selected]:{...(current[selected]||{}),[item]:value}};
      localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
      return next;
    });
  }
  function reset() {
    localStorage.removeItem(STORAGE_KEY); setAnswers({}); setSelected(null);
  }

  return <main className="svb-preview">
    <header><p>PRUEBA LOCAL · NO ENVIA DATOS</p><h1>Checklist SVB</h1><h2>2. Pared lateral izquierda</h2></header>
    <section className="svb-progress" aria-live="polite"><strong>{completed} de {SVB_LEFT_WALL_SECTIONS.length} compartimentos revisados</strong><span>Gris: pendiente · Verde: correcto · Rojo: incidencia</span></section>
    <div className="svb-map">
      <img src="/checklists/svb-paret-lateral-esquerre-real.png" alt="Fotografia real de la pared lateral izquierda de la ambulancia con nueve compartimentos"/>
      {SVB_LEFT_WALL_SECTIONS.map((row)=>{
        const [left,top]=positions[row.id];
        return <button key={row.id} style={{left:`${left}%`,top:`${top}%`}} className={`svb-marker ${statuses[row.id]}`} onClick={()=>setSelected(row.id)} aria-label={`${row.title}: ${statuses[row.id]}`}>{row.id}</button>;
      })}
    </div>
    <button className="svb-reset" onClick={reset}>Reiniciar esta prueba</button>
    {section && <div className="svb-backdrop"><section className="svb-sheet" role="dialog" aria-modal="true" aria-label={section.title}>
      <header><div><small>Pared lateral izquierda</small><h2>{section.title}</h2></div><button className="svb-close" onClick={()=>setSelected(null)} aria-label="Cerrar">×</button></header>
      <div className="svb-items">{section.items.map((item)=>{
        const value=answers[section.id]?.[item];
        return <div className={`svb-item ${value||""}`} key={item}><strong>{item}</strong><div><button className="yes" aria-pressed={value==="ok"} onClick={()=>mark(item,"ok")}>✓</button><button className="no" aria-pressed={value==="issue"} onClick={()=>mark(item,"issue")}>✕</button></div></div>;
      })}</div>
      <footer><span className={`svb-section-state ${statuses[section.id]}`}>{statuses[section.id]==="pending"?"Faltan elementos por revisar":statuses[section.id]==="ok"?"Compartimento correcto":"Compartimento con incidencia"}</span><button className="svb-done" onClick={()=>setSelected(null)}>Volver al dibujo</button></footer>
    </section></div>}
  </main>;
}
