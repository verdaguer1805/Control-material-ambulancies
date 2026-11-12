import React,{useState} from 'react';
import {SVB_PHOTO_LAYOUT} from './svb-photo-layout.mjs';
import {checklistReferenceSections} from './checklist-reference.mjs';
import './vehicle-audit-map.css';
import './checklist-reference-map.css';

// Read-only navigation. No audit draft, storage, answers or network writes.
export default function ChecklistReferenceMap(){
 const [zone,setZone]=useState(null),[point,setPoint]=useState(null);
 const layout=SVB_PHOTO_LAYOUT[zone];
 const sections=checklistReferenceSections('SVB');
 const selected=sections.find(section=>section.key===`${layout?.title}:${point}`);
 const content=section=>section.groups.map((group,index)=><div key={index}>
   {group.title&&<h4>{group.title}</h4>}
   <ul>{group.items.map((item,i)=><li key={i}>{item}</li>)}</ul>
 </div>);
 return <div className="audit-view checklist-reference-map">
  {!zone?<>{[...Object.entries(SVB_PHOTO_LAYOUT),['cabin',{title:'Cabina de conducción'}]].map(([key,value])=>
   <button type="button" className="audit-zone pending" key={key} onClick={()=>setZone(key)}>
    <span>{value.title}<small>Consultar material</small></span><span>›</span>
   </button>)}</>:<>
   <button type="button" className="secondary" onClick={()=>{setZone(null);setPoint(null);}}>← Zonas del checklist</button>
   <h3>{zone==='cabin'?'Cabina de conducción':layout.title}</h3>
   {zone==='cabin'?content(sections.find(section=>section.area==='Cabina de conducción')):<>
    <p>Pulsa un número para consultar el compartimento.</p>
    <div className="audit-photo" style={{aspectRatio:layout.ratio,'--photo-ratio':layout.ratio.split('/').map(Number).reduce((width,height)=>width/height)}}>
     <img src={`./checklists/${layout.image}`} alt={layout.title}/>
     {Object.entries(layout.positions).map(([id,[x,y]])=><button type="button" key={id}
      className={`audit-marker pending ${zone!=='left'&&+id>=4&&+id<=10?'drawer':''}`}
      style={{left:`${x}%`,top:`${y}%`}}
      aria-label={`${layout.title} · Compartimento ${id}`} onClick={()=>setPoint(id)}>{id}</button>)}
    </div>
   </>}
  </>}
  {point!==null&&layout&&<div className="audit-backdrop"><section className="audit-sheet" role="dialog" aria-modal="true"
   aria-label={`${layout.title} · Compartimento ${point}`} onKeyDown={event=>{if(event.key==='Escape')setPoint(null);}}>
   <header><div><small>{layout.title} · Solo consulta</small><h3>{selected?.title||`Compartimento ${point}`}</h3></div>
    <button type="button" className="secondary" autoFocus aria-label="Cerrar compartimento" onClick={()=>setPoint(null)}>×</button></header>
   <div className="audit-items">{selected?content(selected):<p>Contenido pendiente de definir.</p>}</div>
   <footer><button type="button" className="primary full" onClick={()=>setPoint(null)}>Volver a la fotografía</button></footer>
  </section></div>}
 </div>;
}
