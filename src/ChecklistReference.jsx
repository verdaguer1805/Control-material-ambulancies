import React, { useState } from 'react';
import { CHECKLIST_REFERENCE_TYPES, canReadChecklistReference, checklistReferenceSections, filterChecklistReference } from './checklist-reference.mjs';

export default function ChecklistReference({ access }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('SVB');
  const [area, setArea] = useState('');
  const [query, setQuery] = useState('');
  if (!canReadChecklistReference(access)) return null;
  const sections = open ? checklistReferenceSections(type) : [];
  const areas = [...new Set(sections.map(section => section.area).filter(Boolean))];
  const visible = filterChecklistReference(sections, area, query);
  return <section className="card">
    <button type="button" className="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
      {open ? 'Cerrar consulta de checklists' : 'Consultar checklists'}
    </button>
    {open && <>
      <h3>Plantillas de checklist</h3>
      <p>Solo consulta. No inicia auditorías ni registra revisiones.</p>
      <label>Tipo de checklist
        <select value={type} onChange={event => { setType(event.target.value); setArea(''); setQuery(''); }}>
          {CHECKLIST_REFERENCE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
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
  </section>;
}
