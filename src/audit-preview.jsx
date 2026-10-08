import React from 'react';
import {createRoot} from 'react-dom/client';
import VehicleAudit from './VehicleAudit.jsx';
import './styles.css';
import './overrides.css';
createRoot(document.getElementById('root')).render(<main style={{maxWidth:700,margin:'24px auto',padding:16}}>
  <div className="card" style={{background:'#fff4c3'}}><strong>VISTA LOCAL · Auditoría de supervisor</strong><p>No envía datos. Esta prueba no toca el stock ni los checklists de las unidades.</p></div>
  <VehicleAudit supervisor="Material Supervisor · Olot" lot="Lot 5 · Girona - Alt Maresme" zone="Olot" authorized preview />
</main>);
