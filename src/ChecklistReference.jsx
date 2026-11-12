import React, { useState } from 'react';
import ChecklistReferenceMap from './ChecklistReferenceMap.jsx';
import BpChecklistReferenceMap from './BpChecklistReferenceMap.jsx';
import {downloadChecklistReference} from './checklist-reference-export.mjs';
import { CHECKLIST_REFERENCE_TYPES, canReadChecklistReference, checklistReferenceSections, filterChecklistReference } from './checklist-reference.mjs';

export default function ChecklistReference({ access, compact=false }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('');
  const [exporting,setExporting]=useState(false),[exportError,setExportError]=useState('');
  const [area, setArea] = useState('');
  const [query, setQuery] = useState('');
  if (!canReadChecklistReference(access)) return null;
  const sections = open ? checklistReferenceSections(type) : [];
  const areas = [...new Set(sections.map(section => section.area).filter(Boolean))];
  const visible = filterChecklistReference(sections, area, query);
  async function download(){
    if(exporting||!sections.length)return;
    setExporting(true);setExportError('');
    try{await downloadChecklistReference(type);}catch{setExportError('No se ha podido descargar el Excel. Vuelve a intentarlo.');}
    finally{setExporting(false);}
  }
  return <section className={compact?"admin-header-tool":"card"}>
    <button type="button" className="secondary" aria-expanded={open} onClick={() => {setOpen(!open);setType('');setArea('');setQuery('');setExportError('');}}>
      {open ? 'Cerrar consulta de checklists' : 'Consultar checklists'}
    </button>
    {open && <div className="admin-header-tool-content">
      <h3>Plantillas de checklist</h3>
      <p>Solo consulta. No inicia auditorías ni registra revisiones.</p>
      <label>Tipo de checklist
        <select value={type} disabled={exporting} onChange={event => { setType(event.target.value); setArea(''); setQuery(''); setExportError(''); }}>
          <option value="">Selecciona un checklist</option>
          {CHECKLIST_REFERENCE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      {sections.length>0&&<button type="button" className="secondary" disabled={exporting} onClick={download}>{exporting?'Preparando Excel…':`Descargar checklist ${type} en Excel`}</button>}
      {exportError&&<p role="alert">{exportError}</p>}
      {!type?<p>Elige el tipo de checklist que quieres consultar.</p>:type==='SVB'?<ChecklistReferenceMap/>:['Polivalente','Logística'].includes(type)?<p role="status">Pendiente de definir. No hay una plantilla disponible todavía.</p>:<>
      {type==='BP'&&<><BpChecklistReferenceMap/><h4>Lista completa de referencia BP</h4></>}
      {areas.length > 0 && <label>Zona del vehículo
        <select value={area} onChange={event => setArea(event.target.value)}>
          <option value="">Todas las zonas</option>
          {areas.map(value => <option key={value}>{value}</option>)}
        </select>
      </label>}
      <label>Buscar compartimento o material
        <input type="search" value={query} onChange={event => setQuery(event.target.value)}
          placeholder={type === 'SVB' ? 'Ej. compartimento 8 o gasas' : 'Ej. cajón 2 o empapadores'} />
      </label>
      {!visible.length && <p role="status">No se han encontrado apartados con esos filtros.</p>}
      {visible.map(section => <details key={section.key} open={query.trim() ? true : undefined}>
        <summary>{section.area && `${section.area} · `}{section.title}</summary>
        {section.groups.map((group, index) => <div key={index}>
          {group.title && <h4>{group.title}</h4>}
          <ul>{group.items.map((item, i) => <li key={i}>{item}</li>)}</ul>
        </div>)}
      </details>)}
      </>}
    </div>}
  </section>;
}
