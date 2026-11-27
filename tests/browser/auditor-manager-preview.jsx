import React from 'react';
import {createRoot} from 'react-dom/client';
import AuditorManager from '../../src/AuditorManager.jsx';
import '../../src/styles.css';
const first={user_id:'11111111-0000-4000-8000-000000000001',full_name:'Test Auditor Person',active:true,revision:4,lot:'Lot A',zone:'Zone A',warehouse_name:'Central A',created_at:'2026-10-01T10:00:00Z',updated_at:'2026-11-27T15:33:44Z',last_authorized_at:'2026-11-27T15:33:44Z',pending_audits_count:1,pending_materials:true};
const state=window.__auditorAdminFixture={rows:[first,{...first,user_id:'22222222-0000-4000-8000-000000000002',lot:'Lot B',zone:'Zone B',warehouse_name:'Central B',pending_audits_count:0,pending_materials:false}],calls:[]};
async function rpc(name,args){
 state.calls.push({name,args});
 if(name==='list_mobile_auditors')return structuredClone(state.rows);
 if(name==='revoke_mobile_auditor_checked'){
  const row=state.rows.find(row=>row.user_id===args.p_user_id);
  if(row.revision!==args.p_expected_revision||row.updated_at!==args.p_expected_updated_at)throw new Error('AUDITOR_ACCESS_CHANGED');
  row.active=false;return true;
 }
 throw new Error('Unsupported local test request');
}
createRoot(document.getElementById('root')).render(<main style={{padding:16}}><p>SIMULACIÓN LOCAL · No modifica permisos reales.</p><AuditorManager access={{role:'owner'}} rpc={rpc}/></main>);
