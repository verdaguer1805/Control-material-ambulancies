import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {INOPERABILITY_REASONS,operabilityStart,operabilityClose,operabilityRequest,confirmedOperability,saveOperability,readOperability,canUnitDeclareInoperability} from '../src/unit-operability.mjs';
import {readCachedVehicle,cacheConfirmedVehicle} from '../src/unit-vehicle-cache.mjs';
import {inoperabilityReportRows,madridDayStart} from '../src/unit-operability-report.mjs';
import {VEHICLE_REGISTRY,vehicleFromRegistry} from '../src/vehicle-registry.mjs';
const storage=()=>{const values=new Map();return {setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k)||null};};
const lot='Lot 5 · Girona - Alt Maresme';
const form={lot,unit:'G450',vehicle:'5439',reason:'maintenance',hasPatient:'no',description:'Prueba',justification:'Prueba'};
test('inoperatividades solo TSU, BP y SLS; TSNU y perfiles de gestión quedan fuera en cualquier lote',()=>{
 for(const unit of ['G450','BP50','BP52','SL50','SL51'])assert.equal(canUnitDeclareInoperability(unit,'TSU'),true);
 for(const unit of ['T1733','K1376','KE1388','Material supervisor · Olot','Auditor · Figueres'])assert.equal(canUnitDeclareInoperability(unit,'TSU'),false);
 assert.equal(canUnitDeclareInoperability('OTRA','TSNU'),false);
});
test('cinco motivos sin duplicados; sí y no explícitos, fechas completas y sin campos tachados',()=>{
 assert.equal(INOPERABILITY_REASONS.length,5);assert.equal(new Set(INOPERABILITY_REASONS.map(([id])=>id)).size,5);
 assert.throws(()=>operabilityStart({...form,hasPatient:''},'id'),/Indica/);
 const op=operabilityStart(form,'id',new Date('2026-11-02T08:15:30Z'));assert.equal(op.at,'2026-11-02T08:15:30.000Z');assert.equal(op.hasPatient,false);
 assert.equal(operabilityStart({...form,hasPatient:'yes',incidentReference:'000123'},'other').hasPatient,true);
 assert.throws(()=>operabilityStart({...form,reason:'invented'},'id'),/motivo/);
});
test('matrícula vinculada al vehículo, no a la unidad; 104 vehículos sin duplicados',()=>{
 assert.equal(VEHICLE_REGISTRY.length,104);assert.equal(new Set(VEHICLE_REGISTRY.map(r=>`${r.lot}:${r.vehicle}`)).size,104);
 assert.equal(new Set(VEHICLE_REGISTRY.map(r=>`${r.lot}:${r.plate}`)).size,104);
 assert.equal(vehicleFromRegistry(lot,'5438').plate,'7682NLB');assert.equal(vehicleFromRegistry(lot,'5439').plate,'0879NLG');
 assert.equal(vehicleFromRegistry(lot,'5307').zone,'Olot');assert.equal(vehicleFromRegistry('Otro lote','5438'),null);
 assert.equal(VEHICLE_REGISTRY.filter(r=>!r.unit).length,32);
});
test('identidad local oculta del vehículo separada por lote, no por unidad',()=>{
 const store=storage(),row={verified:true,lot,vehicle:'5439',plate:'0879NLG'};
 cacheConfirmedVehicle(store,row,lot,'5439');assert.equal(readCachedVehicle(store,lot,'5439').plate,'0879NLG');
 assert.equal(readCachedVehicle(store,'Otro lote','5439'),null);assert.equal(readCachedVehicle(store,lot,'5438'),null);
 assert.throws(()=>cacheConfirmedVehicle(store,{...row,verified:false},lot,'5439'));
 assert.throws(()=>cacheConfirmedVehicle(store,row,lot,'5438'));
});
test('comunicaciones pendientes conservan identidad y operación entre guardias sin duplicar el intento',()=>{
 const store=storage(),start=operabilityStart(form,'stable-id',new Date('2026-11-02T08:15:30Z'));
 saveOperability(store,{lot,unit:'G450',pending:[start],confirmed:null});
 assert.equal(readOperability(store,lot,'G450').pending[0].id,'stable-id');assert.equal(readOperability(store,lot,'G451'),null);
 const [name,args]=operabilityRequest(start);assert.equal(name,'start_my_unit_inoperability_v2');assert.equal(args.p_vehicle,'5439');assert.equal(args.p_expected_unit,'G450');assert.equal(args.p_has_patient,false);assert.equal('p_plate' in args,false);
 const legacy={...start};delete legacy.incidentReference;assert.equal(operabilityRequest(legacy)[0],'start_my_unit_inoperability');
 const close=operabilityClose({lot,unit:'G450',incidentId:'stable-id',resolution:'Resuelto'},'close-id');
 assert.equal(operabilityRequest(close)[1].p_id,'stable-id');assert.equal(operabilityRequest(close)[1].p_operation_id,'close-id');
});
test('solo una respuesta de la unidad y lote correctos confirma el estado',()=>{
 const row={verified:true,lot,unit:'G450',zone:'Olot',active:null,vehicles:[]};
 assert.equal(confirmedOperability(row,lot,'G450'),true);assert.equal(confirmedOperability({...row,verified:false},lot,'G450'),false);
 assert.equal(confirmedOperability({...row,lot:'otro'},lot,'G450'),false);
 assert.equal(confirmedOperability({...row,active:{id:'id',lot,unit:'G451'}},lot,'G450'),false);
});
test('informe conserva la fotografía histórica y convierte horas con cambio de horario Madrid',()=>{
 const rows=inoperabilityReportRows([{lot,zone:'Olot',unit:'G450',vehicle:'5439',plate:'0879NLG',reason:'material',has_patient:true,started_at:'2026-11-02T08:15:30Z',ended_at:'2026-11-02T09:00:00Z',description:'Prueba',resolution:'Resuelto'}]);
 assert.equal(rows[0]['Matrícula vehículo'],'0879NLG');assert.equal(rows[0]['Indicativo vehículo'],'5439');assert.equal(rows[0].Inicio,'2026-11-02 09:15:30');
 assert.equal(rows[0]['Respuesta'],'Sí');assert.equal(rows[0]['Contexto de la pregunta'],'Asistiendo o trasladando');assert.ok(!Object.keys(rows[0]).some(key=>/teórica|duración|calculada/i.test(key)));
 assert.equal(madridDayStart('2026-10-25'),'2026-10-24T22:00:00.000Z');assert.equal(madridDayStart('2026-10-25',1),'2026-10-25T23:00:00.000Z');
 assert.throws(()=>madridDayStart('2026-02-30'));
});
test('ID de incidente solo con Sí, obligatorio, conserva ceros y aparece en informe nuevo',()=>{
 assert.throws(()=>operabilityStart({...form,hasPatient:'yes'},'id'),/ID del incidente/);
 const operation=operabilityStart({...form,hasPatient:'yes',incidentReference:' 000123 '},'id');
 assert.equal(operation.incidentReference,'000123');assert.equal(operabilityRequest(operation)[1].p_external_incident_id,'000123');
 const no=operabilityStart({...form,hasPatient:'no',incidentReference:'antiguo'},'id');assert.equal(no.incidentReference,'');
 const row=inoperabilityReportRows([{has_patient:true,question_version:2,external_incident_id:'000123'}])[0];
 assert.equal(row['Contexto de la pregunta'],'Activados, asistiendo o trasladando');assert.equal(row['ID del incidente'],'000123');
 const component=fs.readFileSync(new URL('../src/UnitOperability.jsx',import.meta.url),'utf8');assert.match(component,/form.hasPatient==='yes'&&<label>Número ID del incidente/);
});
test('pantalla de unidad nunca renderiza matrícula y el cambio no altera flujos de stock',()=>{
 const source=fs.readFileSync(new URL('../src/UnitOperability.jsx',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\{[^}\n]*\.plate/);assert.doesNotMatch(source,/matrícula/i);
 assert.doesNotMatch(source,/receive_central_stock|transfer_stock_recorded|submit_svb_checklist|submit_tsnu_checklist/);
 const sql=fs.readFileSync(new URL('../sql/unit-operability-v1.sql',import.meta.url),'utf8');
 assert.match(sql,/to_jsonb\(i\)-'plate'/);assert.match(sql,/enable row level security/);assert.match(sql,/admin_has_role/);
 assert.doesNotMatch(sql,/update public\.(?:warehouse_inventory|device_authorizations|unit_warehouse_assignments|svb_checklist_submissions)/i);
});
test('ID vacío se señala en rojo junto al campo y recibe foco, sin enviar',()=>{
 const source=fs.readFileSync(new URL('../src/UnitOperability.jsx',import.meta.url),'utf8');
 assert.match(source,/dialog==='start'&&form.hasPatient==='yes'&&!form.incidentReference.trim\(\)/);
 assert.match(source,/aria-invalid=\{Boolean\(incidentError\)\}/);
 assert.match(source,/aria-describedby=\{incidentError\?'operability-incident-error'/);
 assert.match(source,/scrollIntoView\(\{block:'center'/);
 assert.match(source,/if\(e.target.value.trim\(\)\)\{setIncidentError\(''\)/);
 const css=fs.readFileSync(new URL('../src/unit-operability.css',import.meta.url),'utf8');
 assert.match(css,/input.operability-input-invalid\{border:2px solid #b91c1c;background:#fff1f0/);
});
