import React,{useState} from 'react';
import {BP_ZONES,bpDraftPointItems,bpLegacyItems,bpStatus} from './bp-operational.mjs';
import './vehicle-audit-map.css';
export default function BpChecklistMap({draft,update,busy=false,readOnly=false,onReviewOpenChange=()=>{}}){
 const [zoneId,setZoneId]=useState(''),[point,setPoint]=useState(null);
 const legacy=bpLegacyItems(draft); const zone=BP_ZONES.find(z=>z.id===zoneId);
 const ids=zone?bpDraftPointItems(draft,zone,point):[];
 const items=draft.catalog.filter(i=>ids.includes(i.id));
 const locked=busy||readOnly;
 function mark(id,value){update({...draft,answers:{...draft.answers,[id]:value}});}
 const renderItems=(visibleItems=items)=> <>{!readOnly&&<button type="button" className="secondary full" disabled={locked} onClick={()=>{const answers={...draft.answers};for(const i of visibleItems)if(answers[i.id]!=='issue')answers[i.id]='ok';update({...draft,answers});}}>✓ Marcar todo correcto</button>}
 {[...new Set(visibleItems.map(i=>i.section))].map(section=><div key={section}><h4>{section}</h4>{visibleItems.filter(i=>i.section===section).map(i=><div key={i.id} className={`audit-item ${draft.answers[i.id]||'pending'}`}>
 <strong>{i.label}</strong>{!readOnly&&<div className="audit-choices"><button type="button" className={`yes ${draft.answers[i.id]==='ok'?'active':''}`} disabled={locked} aria-label={`Correcto: ${i.label}`} onClick={()=>mark(i.id,'ok')}>✓</button><button type="button" className={`no ${draft.answers[i.id]==='issue'?'active':''}`} disabled={locked} aria-label={`Incidencia: ${i.label}`} onClick={()=>mark(i.id,'issue')}>✕</button></div>}
 {draft.answers[i.id]==='issue'&&<input aria-label={`Observaciones: ${i.label}`} className="audit-note" placeholder="Observaciones de la incidencia" maxLength={1000} disabled={locked} value={draft.notes?.[i.id]||''} onChange={e=>update({...draft,notes:{...draft.notes,[i.id]:e.target.value}})}/>}
 </div>)}</div>)}</>;
 return <div className="audit-view">{!zone?<>{BP_ZONES.map(z=><button type="button" key={z.id} className={`audit-zone ${bpStatus(draft.answers,bpDraftPointItems(draft,z))}`} onClick={()=>{setZoneId(z.id);setPoint(null);onReviewOpenChange(z.id==='cabin');}}><span className="audit-dot"/><span>{z.title}</span><span>›</span></button>)}{legacy.length>0&&<section><h3>Material de plantilla anterior</h3>{renderItems(legacy)}</section>}</>:<>
 <button type="button" className="secondary" onClick={()=>{setZoneId('');setPoint(null);onReviewOpenChange(false);}}>← Zonas BP · Polivalente</button><h3>{zone.title}</h3>
 {zone.id==='cabin'?renderItems():<div className="audit-photo" style={{aspectRatio:zone.ratio}}><img src={`./checklists/bp/${zone.id}.png`} alt={zone.title}/>{zone.points.map(p=><button type="button" key={p[0]} className={`audit-marker ${bpStatus(draft.answers,bpDraftPointItems(draft,zone,p[0]))}`} style={{left:`${p[1]}%`,top:`${p[2]}%`}} aria-label={`${zone.title} · Punto ${p[0]}`} onClick={()=>{setPoint(p[0]);onReviewOpenChange(true);}}>{p[0]}</button>)}</div>}
 </>}{zone&&point!=null&&<div className="audit-backdrop"><section className="audit-sheet" role="dialog" aria-modal="true" aria-label={`${zone.title} · Punto ${point}`}><header><h3>{zone.title} · {point}</h3><button type="button" className="secondary" onClick={()=>{setPoint(null);onReviewOpenChange(false);}}>Cerrar</button></header><div className="audit-items">{renderItems()}</div><footer><button type="button" className="primary full" onClick={()=>{setPoint(null);onReviewOpenChange(false);}}>Volver a la fotografía</button></footer></section></div>}</div>;
}
