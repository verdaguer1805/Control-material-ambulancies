import React,{useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import UnitOperability from './UnitOperability.jsx';
import {VEHICLE_REGISTRY} from './vehicle-registry.mjs';
import {inoperabilityReportRows} from './unit-operability-report.mjs';
import './styles.css';
import './overrides.css';
const lot='Lot 5 · Girona - Alt Maresme',scopeKey='operability-demo:server',offlineKey='operability-demo:offline';
const profiles=[{unit:'G450',zone:'Olot',vehicle:'5439'},{unit:'G460',zone:'Figueres',vehicle:'5442'},{unit:'G410',zone:'Girona',vehicle:'5410'},{unit:'G472',zone:'Blanes',vehicle:'5453'}];
const storage={getItem:key=>sessionStorage.getItem('operability-demo:mobile:'+key),setItem:(key,value)=>sessionStorage.setItem('operability-demo:mobile:'+key,value),removeItem:key=>sessionStorage.removeItem('operability-demo:mobile:'+key),length:0};
const read=()=>JSON.parse(sessionStorage.getItem(scopeKey)||'[]');
function Preview(){
 const [profile,setProfile]=useState(profiles[0]),[vehicle,setVehicle]=useState(profiles[0].vehicle),[offline,setOffline]=useState(()=>sessionStorage.getItem(offlineKey)==='yes'),[report,setReport]=useState(false),[revision,setRevision]=useState(0);
 const offlineRef=useRef(offline);
 function state(unit){const p=profiles.find(row=>row.unit===unit);return{verified:true,lot,unit,zone:p.zone,active:read().find(row=>row.unit===unit&&!row.ended_at)?Object.fromEntries(Object.entries(read().find(row=>row.unit===unit&&!row.ended_at)).filter(([key])=>key!=='plate')):null,vehicles:VEHICLE_REGISTRY.map(row=>({vehicle:row.vehicle,reference_zone:row.zone,reference_unit:row.unit}))};}
 async function transport(name,args){
  if(offlineRef.current)throw new TypeError('Failed to fetch');
  if(args.p_expected_lot!==lot||!profiles.some(row=>row.unit===args.p_expected_unit))throw new Error('OPERABILITY_SCOPE_CHANGED');
  if(name==='get_my_unit_operability')return state(args.p_expected_unit);
  if(name==='get_my_operability_vehicle'){const row=VEHICLE_REGISTRY.find(row=>row.vehicle===args.p_vehicle);if(!row)throw new Error('VEHICLE_NOT_REGISTERED');return{verified:true,lot,vehicle:row.vehicle,plate:row.plate};}
  let rows=read();
  if(name==='start_my_unit_inoperability'||name==='start_my_unit_inoperability_v2'){
   if(rows.some(row=>row.id===args.p_id))return state(args.p_expected_unit);
   if(rows.some(row=>row.unit===args.p_expected_unit&&!row.ended_at))throw new Error('UNIT_ALREADY_INOPERATIVE');
   const vehicle=VEHICLE_REGISTRY.find(row=>row.vehicle===args.p_vehicle);if(!vehicle)throw new Error('VEHICLE_NOT_REGISTERED');
   rows.push({id:args.p_id,lot,zone:profiles.find(row=>row.unit===args.p_expected_unit).zone,unit:args.p_expected_unit,vehicle:vehicle.vehicle,plate:vehicle.plate,reason:args.p_reason,has_patient:args.p_has_patient,question_version:name.endsWith('_v2')?2:1,external_incident_id:args.p_has_patient?args.p_external_incident_id||null:null,description:args.p_description,justification:args.p_justification,started_at:args.p_started_at,received_at:new Date().toISOString(),ended_at:null});
  }else if(name==='close_my_unit_inoperability'){
   rows=rows.map(row=>row.id===args.p_id?{...row,ended_at:args.p_ended_at,resolution:args.p_resolution,closed_received_at:new Date().toISOString()}:row);
  }else throw new Error('Unknown demo operation');
  sessionStorage.setItem(scopeKey,JSON.stringify(rows));setRevision(v=>v+1);return state(args.p_expected_unit);
 }
 function toggle(){const next=!offline;offlineRef.current=next;sessionStorage.setItem(offlineKey,next?'yes':'no');setOffline(next);window.dispatchEvent(new Event(next?'offline':'online'));}
 const rows=inoperabilityReportRows(read());
 return <main style={{maxWidth:1100,margin:'20px auto',padding:16}}>
  <section className="card" style={{background:'#fff2bd'}}><h1>Inoperatividades · Vista local</h1><p>No envía datos al servidor ni modifica unidades, consumos ni stock reales.</p>
   <label>Unidad de ejemplo<select value={profile.unit} onChange={e=>{const next=profiles.find(row=>row.unit===e.target.value);setProfile(next);setVehicle(next.vehicle);}}>{profiles.map(row=><option key={row.unit} value={row.unit}>{row.unit} · {row.zone}</option>)}</select></label>
   <label>Vehículo actual de ejemplo<input value={vehicle} onChange={e=>setVehicle(e.target.value)}/></label>
   <button className="secondary" onClick={toggle}>{offline?'Recuperar conexión de prueba':'Simular sin cobertura'}</button> <button className="secondary" onClick={()=>setReport(!report)}>{report?'Ocultar informe de ejemplo':'Ver informe de ejemplo'}</button>
  </section>
  <section style={{maxWidth:390,margin:'20px auto',border:'1px solid #c3cdd0',borderRadius:18,overflow:'hidden',background:'#f4f7f8'}}>
   <header style={{background:'#d71920',color:'white',textAlign:'center',padding:16}}><h2 style={{fontSize:20,margin:0}}>Control de material</h2><small>Vista local · Sin datos reales</small>
    <UnitOperability key={`${lot}:${profile.unit}`} lot={lot} unit={profile.unit} service="TSU" authorized initialVehicle={vehicle} storage={storage} transport={transport}/>
    <small style={{display:'block',marginTop:10}}>{lot}<br/>Supervisión {profile.zone}</small>
   </header><div style={{padding:20}}><button className="checklist-yellow" style={{width:'100%',padding:16,background:'#ffdc45'}}>Checklist (ejemplo visual)</button><p>Vehículo actual: {vehicle}</p><p>Los consumos y el checklist continúan funcionando. Declarar inoperatividad no modifica su contenido.</p></div>
  </section>
  {report&&<section className="card" key={revision}><h2>Informe de inoperatividades · Ejemplo local</h2><p>La matrícula solo se presenta en esta vista de informe, nunca en el formulario ni en el indicador.</p><div style={{overflowX:'auto'}}><table><thead><tr>{Object.keys(rows[0]||{'Sin registros':''}).map(key=><th key={key}>{key}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{Object.values(row).map((value,j)=><td key={j} style={{padding:8,whiteSpace:'nowrap'}}>{value||'—'}</td>)}</tr>)}</tbody></table></div></section>}
 </main>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
