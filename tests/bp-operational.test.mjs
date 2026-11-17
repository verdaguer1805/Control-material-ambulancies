import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import XLSX from 'xlsx-js-style';
import {BP_ITEMS,BP_ZONES,bpPointItems,bpStatus,bpDraftKey,bpPayload,bpSnapshot,isBpUnit} from '../src/bp-operational.mjs';
import {BP_CHECKLIST_SECTIONS} from '../src/bp-checklist-catalog.mjs';
import {auditItems,auditComplete,auditRequest} from '../src/vehicle-audit.mjs';
import {checklistReferenceSections} from '../src/checklist-reference.mjs';
import {readUnitChecklist,UNIT_CHECKLIST_KEY} from '../src/unit-checklist-config.mjs';
import {svbAssignedGuard} from '../src/svb-guard-window.mjs';
import {bpReportSheet} from '../src/bp-report.mjs';
const full=()=>({lot:'Lot X',zone:'Zona Y',unit:'BP99',vehicle:'5517',guardCode:'141126',guardStartedAt:'2026-11-14T06:00:00.000Z',catalog:BP_ITEMS,answers:Object.fromEntries(BP_ITEMS.map(i=>[i.id,'ok'])),notes:{}});

test('BP rear-left has scissors stretcher, under-vacuum retains spinal board and rear-right has four glove sizes',()=>{
 const item=id=>BP_ITEMS.find(i=>i.id===id);
 assert.equal(item('bp-item-163').label,'Camilla de tijera · 1 unidad');
 assert.match(item('bp-item-163').section,/Puerta trasera izquierda/);
 assert.equal(item('bp-item-158').label,'Tablero espinal · 1 unidad');
 assert.match(item('bp-item-158').section,/Debajo del colchón de vacío/);
 assert.equal(item('bp-item-183').label,'Guantes anticorte · 4 pares (1 par de cada talla: S, M, L y XL)');
 assert.match(item('bp-item-183').section,/Puerta trasera derecha/);
});
test('BP restraint bag belongs only to left compartment 2 and preserves its identity and quantity',()=>{
 const zone=BP_ZONES.find(z=>z.id==='left');
 assert.ok(!bpPointItems(zone,1).includes('bp-item-26'));
 const bags=bpPointItems(zone,2).filter(id=>id==='bp-item-26');
 assert.equal(bags.length,1);
 assert.equal(BP_ITEMS.find(i=>i.id===bags[0]).label,'Bolsa de contención para paciente agitado · 1 unidad');
 assert.equal(BP_ITEMS.filter(i=>i.id==='bp-item-26').length,1);
});

test('BP pending report does not blame units for dates before operational launch',()=>{
 const sheet=bpReportSheet(XLSX,[],['BP99'],'2026-11-01','2026-11-13',v=>({date:v,time:''}));
 assert.equal(XLSX.utils.sheet_to_json(sheet).length,0);
});
test('BP units, audits and reference use exactly the same 222 items, without duplication',()=>{
 assert.equal(BP_ITEMS.length,222);assert.equal(new Set(BP_ITEMS.map(i=>i.id)).size,222);
 assert.deepEqual(auditItems('Polivalente'),BP_ITEMS);
 assert.deepEqual(checklistReferenceSections('BP').flatMap(s=>s.groups.flatMap(g=>g.items)),BP_ITEMS.map(i=>i.label));
 assert.deepEqual(BP_ITEMS.map(i=>i.id).sort(),BP_CHECKLIST_SECTIONS.flatMap(s=>s.items.map(i=>i.id)).sort());
 assert.equal(BP_ZONES.length,7);
 for(const z of BP_ZONES)for(const p of z.points)assert.ok(bpPointItems(z,p[0]).length);
 assert.ok(BP_ZONES.find(z=>z.id==='cabin').groups[0].items.length);
});
test('BP scope and migration are global without rewriting storage or changing non-BP assignments',()=>{
 for(const lot of ['Lot 1','Lot 5 · Girona - Alt Maresme','Lot X']){
  let writes=0;const storage={getItem:()=>null,setItem:()=>writes++};
  for(const unit of ['BP50','BP51','BP52','BP99'])assert.equal(readUnitChecklist(storage,unit,lot).checklist,'Polivalente');
  assert.equal(readUnitChecklist(storage,'G999',lot).checklist,'');assert.equal(writes,0);
 }
 const value={unit:'BP99',lot:'X',zone:'Other',service:'TSU',checklist:'SVB',shift:'08:00'};
 const result=readUnitChecklist({getItem:key=>key===UNIT_CHECKLIST_KEY?JSON.stringify(value):null},'BP99','X');
 assert.deepEqual(result,{...value,checklist:'Polivalente'});assert.ok(!isBpUnit('G452'));
});
test('BP drafts isolate lot, zone, unit, guard and vehicle, retain incidents and reject incomplete sends',()=>{
 const d=full(),key=bpDraftKey(d);for(const field of ['lot','zone','unit','guardCode','vehicle'])assert.notEqual(bpDraftKey({...d,[field]:'other'}),key);
 d.answers[BP_ITEMS[0].id]='issue';d.notes[BP_ITEMS[0].id]='Falta material';
 const p=bpPayload(d);assert.equal(p.p_items.length,222);assert.equal(p.p_items[0].status,'issue');assert.equal(p.p_items[0].note,'Falta material');
 assert.ok(auditComplete({...d,type:'Polivalente'}));assert.equal(auditRequest({...d,id:'x',type:'Polivalente'}).p_type,'Polivalente');
 const snapshot=bpSnapshot(d);delete d.answers[BP_ITEMS[1].id];assert.equal(bpStatus(d.answers,BP_ITEMS.map(i=>i.id)),'pending');assert.throws(()=>bpPayload(d));assert.notEqual(bpSnapshot(d),snapshot);
});
test('BP uses one-hour advance guard selection and keeps draft unchanged across scheduled shift start',()=>{
 const a=svbAssignedGuard('07:00',new Date('2026-11-14T05:50:00Z'));
 const b=svbAssignedGuard('07:00',new Date('2026-11-14T06:10:00Z'));
 assert.deepEqual(a,b);const previous=svbAssignedGuard('07:00',new Date('2026-11-14T04:59:00Z'));assert.notEqual(a.code,previous.code);
});
test('BP report includes true receipt times, red incidents and white pending units with collapsed details',()=>{
 const d=full();d.answers[BP_ITEMS[0].id]='issue';
 const record={unit:d.unit,guard_started_at:d.guardStartedAt,vehicle_label:d.vehicle,submitted_at:'2026-11-14T09:15:00Z',items:bpPayload(d).p_items};
 const sheet=bpReportSheet(XLSX,[record],[{unit:'BP99'},{unit:'BP98'}],'2026-11-14','2026-11-14',x=>({date:x.slice(0,10),time:x.slice(11,19)}));
 assert.equal(sheet.F2.v,'Con incidencia');assert.equal(sheet.A2.s.fill.fgColor.rgb,'F8CDCD');assert.equal(sheet.E2.v,'09:15:00');
 assert.equal(sheet['!rows'][2].hidden,true);assert.equal(sheet.F4.v,'No realizado');assert.equal(sheet.A4.s.fill.fgColor.rgb,'FFFFFF');
});
test('BP UI uses independent storage and RPC, while unit and audit stock paths stay separate',()=>{
 const component=fs.readFileSync(new URL('../src/BpUnitChecklist.jsx',import.meta.url),'utf8');
 assert.match(component,/submit_bp_checklist/);assert.match(component,/bpDraftKey/);assert.match(component,/current\.start!==draft\.guardStartedAt/);
 assert.doesNotMatch(component,/warehouse_inventory|save_consumption|submit_vehicle_audit/);
});
