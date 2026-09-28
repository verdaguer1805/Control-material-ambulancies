import React, { useMemo, useState } from "react";
import { SVB_FRONT_WALL_SECTIONS, frontSectionStatus } from "../src/svb-front-wall-data.mjs";
import "./svb-left-wall-preview.css";
import "./svb-front-wall-preview.css";

const STORAGE_KEY = "cma_svb_front_wall_preview_v1";
const positions = {
  1:[17,26.2], 2:[50,26.2],
  3:[76,45],
  4:[12.5,61], 5:[13.5,65.7], 6:[15,70.1], 7:[16.3,73.7], 8:[17.4,77.4],
  9:[42,75.8], 10:[79,69], 11:[91,51], 12:[88,75.8], 13:[79,57.5]
};
function readDraft(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}")}catch{return{}}}

export default function SvbFrontWallPreview(){
  const [answers,setAnswers]=useState(readDraft),[selected,setSelected]=useState(null);
  const section=SVB_FRONT_WALL_SECTIONS.find((row)=>row.id===selected);
  const statuses=useMemo(()=>Object.fromEntries(SVB_FRONT_WALL_SECTIONS.map((row)=>[row.id,frontSectionStatus(row,answers)])),[answers]);
  const reviewable=SVB_FRONT_WALL_SECTIONS.filter((row)=>!row.pendingDefinition),completed=reviewable.filter((row)=>statuses[row.id]!=="pending").length;
  function mark(item,value){setAnswers((current)=>{const next={...current,[selected]:{...(current[selected]||{}),[item]:value}};localStorage.setItem(STORAGE_KEY,JSON.stringify(next));return next})}
  function reset(){localStorage.removeItem(STORAGE_KEY);setAnswers({});setSelected(null)}
  return <main className="svb-preview"><header><p>PRUEBA LOCAL · NO ENVÍA DATOS</p><h1>Checklist SVB</h1><h2>3. Pared frontal</h2></header>
    <section className="svb-progress"><strong>{completed} de {reviewable.length} zonas revisadas</strong><span>Gris: pendiente · Verde: correcto · Rojo: incidencia</span></section>
    <div className="svb-map svb-front-map"><img src="/checklists/svb-paret-frontal-real.png" alt="Fotografía real de la pared frontal de la ambulancia"/>{SVB_FRONT_WALL_SECTIONS.map((row)=>{const[left,top]=positions[row.id];return <button key={row.id} style={{left:`${left}%`,top:`${top}%`}} className={`svb-marker front-marker ${row.id>=3&&row.id<=8?"drawer-marker":""} ${statuses[row.id]}`} onClick={()=>setSelected(row.id)}>{row.id}</button>})}</div>
    <button className="svb-reset" onClick={reset}>Reiniciar esta prueba</button>
    {section&&<div className="svb-backdrop"><section className="svb-sheet" role="dialog" aria-modal="true"><header><div><small>Pared frontal</small><h2>{section.title}</h2></div><button className="svb-close" onClick={()=>setSelected(null)}>×</button></header>
      {section.pendingDefinition?<div className="svb-items"><p><strong>Contenido pendiente de definir.</strong></p></div>:<div className="svb-items">{(section.groups||[{items:section.items}]).map((group,index)=><section key={group.title||index} className="svb-group">{group.title&&<h3>{group.title}</h3>}{group.items.map((item)=>{const value=answers[section.id]?.[item];return <div className={`svb-item ${value||""}`} key={item}><strong>{item}</strong><div><button className="yes" aria-pressed={value==="ok"} onClick={()=>mark(item,"ok")}>✓</button><button className="no" aria-pressed={value==="issue"} onClick={()=>mark(item,"issue")}>✕</button></div></div>})}</section>)}</div>}
      <footer>{(section.pendingDefinition||section.items?.length!==0)&&<span className={`svb-section-state ${statuses[section.id]}`}>{statuses[section.id]==="undefined"?"Contenido pendiente de definir":statuses[section.id]==="pending"?"Faltan elementos por revisar":statuses[section.id]==="ok"?"Zona correcta":"Zona con incidencia"}</span>}<button className="svb-done" onClick={()=>setSelected(null)}>Volver a la fotografía</button></footer>
    </section></div>}</main>
}
