import React, {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import './unit-selector.css';

export default function UnitSelector({units, value, onChange, disabled = false}) {
  const [open,setOpen] = useState(false);
  const entries = Object.entries(units || {}).sort(([a,aa],[b,bb]) => {
    const sa = /^SUPERVISOR_|^Material supervisor/i.test(a);
    const sb = /^SUPERVISOR_|^Material supervisor/i.test(b);
    return Number(sa)-Number(sb) || aa.localeCompare(bb,'es') || a.localeCompare(b,'es',{numeric:true});
  });
  useEffect(()=>{
    if(!open) return;
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const key=e=>{if(e.key==='Escape'){e.stopPropagation();setOpen(false);}};
    document.addEventListener('keydown',key,true);
    return ()=>{document.body.style.overflow=previous;document.removeEventListener('keydown',key,true);};
  },[open]);
  return <>
    <button type="button" className="unit-select-trigger" disabled={disabled || !entries.length} aria-haspopup="dialog" onClick={()=>setOpen(true)}>
      {value ? `${value} — ${units[value] || ''}` : 'Selecciona una unidad'} <span aria-hidden="true">▾</span>
    </button>
    {open && createPortal(<div className="unit-picker-overlay"><section className="unit-picker-panel" role="dialog" aria-modal="true" aria-label="Selecciona una unidad">
      <header><h2>Selecciona una unidad</h2><button type="button" autoFocus onClick={()=>setOpen(false)} aria-label="Cerrar selección de unidad">×</button></header>
      <div className="unit-picker-scroll">{entries.map(([id,label])=><button type="button" key={id} className={`unit-picker-row${value===id?' is-selected':''}`} aria-pressed={value===id} onClick={()=>{onChange(id);setOpen(false);}}>
        <strong>{/^SUPERVISOR_|^Material supervisor/i.test(id) ? 'Material supervisor' : id}</strong><span>{label}</span>
      </button>)}</div>
      <footer><button type="button" onClick={()=>setOpen(false)}>Cancelar</button></footer>
    </section></div>,document.body)}
  </>;
}
