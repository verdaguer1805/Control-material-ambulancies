import React from 'react';
import {createRoot} from 'react-dom/client';
import BpUnitChecklist from '../src/BpUnitChecklist.jsx';
import ChecklistDemo from '../src/ChecklistDemo.jsx';
import ChecklistPendingNotice from '../src/ChecklistPendingNotice.jsx';
import '../src/styles.css';
import '../src/overrides.css';
const mode=new URLSearchParams(location.search).get('mode');
createRoot(document.getElementById('root')).render(<main style={{maxWidth:650,margin:'auto',padding:16}}>
 {mode==='bp'?<BpUnitChecklist unit="BP50" lot="Test lot" zone="Test zone" shift="07:00" authorized/>:
 mode==='tsnu'?<ChecklistDemo unit="T9999" lot="Test lot" zone="Test zone" warehouse="Test warehouse" assignedChecklist="TSNU" production/>:
 <ChecklistPendingNotice unit="G450" lot="Lot 5 · Girona - Alt Maresme" zone="Olot" type="SVB"/>}
 </main>);
