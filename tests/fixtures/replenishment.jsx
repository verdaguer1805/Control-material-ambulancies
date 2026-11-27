import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import ReplenishmentPanel from '../../src/ReplenishmentPanel.jsx';
import {WAREHOUSE_DEPLOYMENTS,getWarehouseScope} from '../../src/warehouse-config.mjs';
import {replenishmentGroups} from '../../src/replenishment.mjs';
import '../../src/styles.css';
import '../../src/stock-demo.css';
const materials=['Tubo de silicona LSU','Gasas','Guantes estériles'];
function App(){
 const [zone,setZone]=useState(0),[open,setOpen]=useState(true),[ready,setReady]=useState(false);
 const [data,setData]=useState({levels:{},minimums:{},groups:[]});
 const scope=getWarehouseScope(WAREHOUSE_DEPLOYMENTS[zone].lot,WAREHOUSE_DEPLOYMENTS[zone].zone);
 async function refresh(){
  setReady(false);
  const response=await fetch('/__test/inventory?zone='+encodeURIComponent(scope.zone));
  if(!response.ok)throw new Error('TEST_READ_FAILED');
  const next=await response.json();
  next.groups=replenishmentGroups(scope.locations,materials,next.levels,next.minimums,next.pending||{},next.types||{});
  setData(next);setReady(true);return next;
 }
 window.refreshTestInventory=refresh;
 return <main><h1>Reposición · PRUEBA SIN ESTOC REAL</h1><select aria-label="Zona de prueba" value={zone} onChange={e=>{setOpen(false);setZone(Number(e.target.value));}}>{WAREHOUSE_DEPLOYMENTS.map((c,i)=><option key={c.zone} value={i}>{c.zone}</option>)}</select><button onClick={()=>setOpen(true)}>Abrir reposición</button>
 {open&&<ReplenishmentPanel key={scope.key} scope={scope} actor="test-owner" materials={materials} materialLabel={m=>m} groups={ready?data.groups:[]} levels={data.levels} minimums={data.minimums} inventoryReady={ready} onRefresh={refresh} onClose={()=>setOpen(false)} preview onSubmit={async request=>{
  const response=await fetch('/__test/deliver',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
  const result=await response.json();if(!response.ok)throw new Error(result.error);return result;
 }}/>}</main>;
}
createRoot(document.getElementById('root')).render(<App/>);
