import React,{useState} from 'react';
import {bpItemLabel} from './bp-quantity.mjs';
import {BP_PHOTO_DRAFT,bpPhotoSections} from './bp-photo-draft.mjs';
import './vehicle-audit-map.css';
import './checklist-reference-map.css';

export default function BpChecklistReferenceMap(){
 const [zoneId,setZoneId]=useState(''),[point,setPoint]=useState(null);
 const zone=BP_PHOTO_DRAFT.find(z=>z.id===zoneId);
 const sections=point?bpPhotoSections(zone,point):[];
 return <div className="audit-view checklist-reference-map">
  {!zone?<>{BP_PHOTO_DRAFT.map(z=><button type="button" className="audit-zone pending" key={z.id} onClick={()=>setZoneId(z.id)}><span>{z.title}<small>Consultar material</small></span><span>›</span></button>)}</>:<>
   <button type="button" className="secondary" onClick={()=>{setZoneId('');setPoint(null);}}>← Zonas del checklist</button>
   <h3>{zone.title}</h3>
   <p>Pulsa un número para consultar el compartimento.</p>
   <div className="audit-photo" style={{aspectRatio:zone.ratio,'--photo-ratio':zone.ratio}}>
    <img src={`./checklists/bp/${zone.id}.png`} alt={zone.title}/>
    {zone.points.map(p=><button type="button" className="audit-marker pending" key={p[0]} style={{left:`${p[1]}%`,top:`${p[2]}%`}} aria-label={`Consultar punto ${p[0]}`} onClick={()=>setPoint(p)}>{p[0]}</button>)}
   </div>
  </>}
  {point&&zone&&<div className="audit-backdrop"><section className="audit-sheet" role="dialog" aria-modal="true" aria-label={`${zone.title} · Punto ${point[0]}`} onKeyDown={e=>{if(e.key==='Escape')setPoint(null);}}>
   <header><div><small>{zone.title} · Solo consulta</small><h3>Compartimento {point[0]}</h3></div><button type="button" autoFocus className="secondary" aria-label="Cerrar compartimento" onClick={()=>setPoint(null)}>×</button></header>
   <div className="audit-items">
    {!sections.length&&<p>Pendiente de confirmar qué material corresponde a este punto.</p>}
    {sections.map(s=><div key={s.id}><h4>{s.title}</h4><ul>{s.items.map(item=><li key={item.id}>{bpItemLabel(item)}</li>)}</ul></div>)}
   </div><footer><button type="button" className="primary full" onClick={()=>setPoint(null)}>Volver a la fotografía</button></footer>
  </section></div>}
 </div>;
}
