import React,{useState} from 'react';
import {SVB_PHOTO_LAYOUT} from './svb-photo-layout.mjs';
import {materialDisplayName} from './material-display.mjs';
import './vehicle-audit-map.css';

export function auditPhotoItems(draft,zone,id) {
  if(zone==='cabin')return draft.catalog.filter(item=>item.id.startsWith('cabin:'));
  const prefix=`${SVB_PHOTO_LAYOUT[zone].title}-${id}-`;
  return draft.catalog.filter(item=>item.id.startsWith(prefix));
}
function status(draft,items) {
  if(!items.length || items.some(item=>!['ok','issue'].includes(draft.answers[item.id])))return 'pending';
  return items.some(item=>draft.answers[item.id]==='issue')?'issue':'ok';
}
export default function VehicleAuditMap({draft,update,busy}) {
  const [zone,setZone]=useState(null),[point,setPoint]=useState(null);
  const locked=busy||!!draft.confirmedAt,layout=SVB_PHOTO_LAYOUT[zone];
  const items=point===null?[]:auditPhotoItems(draft,zone,point);
  function mark(item,value){update({...draft,answers:{...draft.answers,[item.id]:value},confirmedAt:null});}
  function markAll(){const answers={...draft.answers};for(const item of items)if(answers[item.id]!=='issue')answers[item.id]='ok';update({...draft,answers,confirmedAt:null});}
  const row=item=><div className={`audit-item ${draft.answers[item.id]||'pending'}`} key={item.id}>
    <strong>{materialDisplayName(item.label)}</strong><div className="audit-choices">
      <button type="button" disabled={locked} className={draft.answers[item.id]==='ok'?'yes active':'yes'} aria-label={`Correcto: ${item.label}`} onClick={()=>mark(item,'ok')}>✓</button>
      <button type="button" disabled={locked} className={draft.answers[item.id]==='issue'?'no active':'no'} aria-label={`Incidencia: ${item.label}`} onClick={()=>mark(item,'issue')}>✕</button>
    </div>
    {draft.answers[item.id]==='issue'&&<input className="audit-note" aria-label={`Observaciones: ${item.label}`} placeholder="Observaciones de la incidencia" maxLength={1000} disabled={locked} value={draft.notes[item.id]||''} onChange={e=>update({...draft,notes:{...draft.notes,[item.id]:e.target.value},confirmedAt:null})}/>}
  </div>;
  return <div className="audit-view">
    {!zone?<><h3>Selecciona una zona</h3>{[...Object.entries(SVB_PHOTO_LAYOUT),['cabin',{title:'Cabina de conducción'}]].map(([key,value])=>{
      const zoneItems=key==='cabin'?auditPhotoItems(draft,'cabin',1):draft.catalog.filter(item=>item.id.startsWith(`${value.title}-`));
      const state=status(draft,zoneItems);
      return <button type="button" key={key} className={`audit-zone ${state}`} onClick={()=>setZone(key)}><span className="audit-dot"/><span>{value.title}<small>{state==='pending'?'Revisar zona':state==='issue'?'Zona con incidencia':'Zona revisada'}</small></span><span>›</span></button>;
    })}</>:<>
      <button type="button" className="secondary" onClick={()=>{setZone(null);setPoint(null);}}>← Zonas del checklist</button>
      <h3>{zone==='cabin'?'Cabina de conducción':layout.title}</h3>
      <p className="small">Gris: pendiente · Verde: correcto · Rojo: incidencia</p>
      {zone==='cabin'?<>{auditPhotoItems(draft,'cabin',1).map(row)}</>:<div className="audit-photo" style={{aspectRatio:layout.ratio}}>
        <img src={`./checklists/${layout.image}`} alt={layout.title}/>
        {Object.entries(layout.positions).map(([id,[x,y]])=><button type="button" key={id} className={`audit-marker ${zone!=='left'&&+id>=4&&+id<=10?'drawer':''} ${status(draft,auditPhotoItems(draft,zone,id))}`} style={{left:`${x}%`,top:`${y}%`}} aria-label={`${layout.title} · Compartimento ${id}${layout.labels?.[id]?` · ${layout.labels[id]}`:""}`} onClick={()=>setPoint(id)}>{id}</button>)}
      </div>}
    </>}
    {point!==null&&zone!=='cabin'&&<div className="audit-backdrop"><section className="audit-sheet" role="dialog" aria-modal="true" aria-label={`${layout.title} · Compartimento ${point}`}>
      <header><div><small>{layout.title}</small><h3>Compartimento {point}{layout.labels?.[point]?` · ${layout.labels[point]}`:""}</h3></div><button type="button" className="secondary" aria-label="Cerrar compartimento" onClick={()=>setPoint(null)}>×</button></header>
      <div className="audit-items">{items.length?<><button type="button" className="secondary full" disabled={locked} onClick={markAll}>✓ Marcar todo correcto</button>{[...new Set(items.map(item=>item.section))].map(title=><div key={title}><h4>{title.split(' · ').slice(2).join(' · ')||title}</h4>{items.filter(item=>item.section===title).map(row)}</div>)}</>:<p>Contenido pendiente de definir.</p>}</div>
      <footer><button type="button" className="primary full" onClick={()=>setPoint(null)}>Volver a la fotografía</button></footer>
    </section></div>}
  </div>;
}
