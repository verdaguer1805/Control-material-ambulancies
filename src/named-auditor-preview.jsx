import React from 'react';
import {createRoot} from 'react-dom/client';
import AuditorPortal from './AuditorPortal.jsx';
import './styles.css';import './overrides.css';import './falck-brand.css';
const prefix='cma_named_auditor_demo:';
const storage={getItem:key=>sessionStorage.getItem(prefix+key),setItem:(key,value)=>sessionStorage.setItem(prefix+key,value),removeItem:key=>sessionStorage.removeItem(prefix+key)};
let profile={user_id:'local-example',full_name:'Marc Serra',lot:'Lot 5 · Girona - Alt Maresme',zone:'Olot',warehouse_id:'example-olot',warehouse_name:'Olot central',revision:1,active:true,verified:true};
const warehouses=[{id:'example-olot',name:'Olot central',lot:profile.lot,zone:'Olot',kind:'central'},{id:'example-fig',name:'Figueres central',lot:profile.lot,zone:'Figueres',kind:'central'}];
let materialDraft=null;const audits=[],receipts=new Map();
async function rpc(name,p={}){
 if(name==='get_my_auditor_profile')return {...profile};
 if(name==='get_auditor_warehouse_options')return warehouses;
 if(name==='get_my_auditor_material_options')return ['Gasas 20x20','Suero fisiológico 5 ml','Bolsas de vómito'];
 if(name==='get_my_auditor_materials')return materialDraft;
 if(name==='get_my_auditor_consumption')return receipts.get(p.p_id)||null;
 if(name==='get_my_auditor_pending_audits')return audits.filter(a=>!a.submitted_at);
 if(name==='authorize_mobile_auditor'){
  if(audits.some(a=>!a.submitted_at)||Object.values(materialDraft?.materials||{}).some(Number))throw new Error('AUDITOR_PENDING_WORK');
  const w=warehouses.find(w=>w.id===p.p_warehouse_id&&w.zone===p.p_zone&&w.lot===p.p_lot);if(!w)throw new Error('AUDITOR_WAREHOUSE_MISMATCH');
  profile={...profile,full_name:p.p_full_name,lot:p.p_lot,zone:p.p_zone,warehouse_id:w.id,warehouse_name:w.name,revision:profile.revision+1};return {...profile};
 }
 if(name==='save_mobile_auditor_materials'){materialDraft={id:p.p_id,materials:p.p_items,edit_version:p.p_version,profile_revision:p.p_revision};return true;}
 if(name==='submit_mobile_auditor_consumption'){if(p.p_warehouse_id!==profile.warehouse_id)throw new Error('AUDITOR_WAREHOUSE_MISMATCH');const r={id:p.p_id,warehouse_id:profile.warehouse_id,profile_revision:profile.revision,materials:p.p_items};receipts.set(p.p_id,r);materialDraft=null;return r;}
 if(name==='begin_mobile_auditor_audit'){audits.push({id:p.p_id,full_name:profile.full_name,zone:profile.zone,lot:profile.lot,warehouse_id:profile.warehouse_id,vehicle:p.p_vehicle,checklist_type:p.p_type,catalog:p.p_catalog,answers:{},notes:{},edit_version:0,started_at:new Date().toISOString()});return audits.at(-1);}
 if(name==='save_mobile_auditor_draft'){const d=audits.find(a=>a.id===p.p_id);Object.assign(d,{answers:p.p_answers,notes:p.p_notes,edit_version:p.p_version});return true;}
 if(name==='submit_mobile_auditor_audit'){const d=audits.find(a=>a.id===p.p_id);d.submitted_at=new Date().toISOString();return {received_at:d.submitted_at};}
 if(name==='leave_mobile_auditor')return true;
 throw new Error('Unsupported local simulation');
}
function resetExample(){for(const key of Object.keys(sessionStorage))if(key.startsWith(prefix))sessionStorage.removeItem(key);location.reload();}
createRoot(document.getElementById('root')).render(<><div style={{padding:8,background:'#fff4c3',textAlign:'center'}}><button onClick={resetExample}>Reiniciar solo el ejemplo local</button></div><AuditorPortal rpc={rpc} storage={storage} simulation onLeave={resetExample}/></>);
