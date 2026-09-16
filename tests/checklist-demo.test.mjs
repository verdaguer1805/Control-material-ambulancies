import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import XLSX from "xlsx-js-style";
import {DEMO_KEY,DEMO_ITEMS,canDemoChecklist,inChecklistWindow,checklistStatus,saveDemo,readDemo,completeDemo,filterDemo} from "../src/checklist-demo.mjs";
import {buildChecklistWorkbook} from "../src/checklist-demo-export.mjs";
const base={lot:"Lot 5",zone:"Olot",warehouse:"Camprodon",unit:"G453",date:"2026-09-16",phase:"open",answers:{},notes:{}};
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v),map};};
test('TSNU daily checklist ignores two-hour phase and separates calendar dates',()=>{
 const daily={...base,service:'TSNU',vehicleType:'TSNU',phase:'closed'};
 const now=new Date(2026,8,16,23,59);
 assert.equal(checklistStatus(daily,now),'Pendiente');
 assert.equal(checklistStatus({...daily,date:'2026-09-15'},now),'No realizado');
 assert.equal(checklistStatus(completeDemo({...daily,answers:Object.fromEntries(DEMO_ITEMS.map(m=>[m,'ok']))}),now),'Correcto');
 const store=memory();saveDemo(store,daily);saveDemo(store,{...daily,date:'2026-09-17'});assert.equal(readDemo(store).length,2);
});
test("authorized, unchecked, supervisor and enforcement-off devices cannot access demo",()=>{
  const demo={checked:true,enforcement:true,authorized:false};
  assert.equal(canDemoChecklist(demo,"G453"),true);
  for(const auth of [{...demo,authorized:true},{...demo,checked:false},{...demo,enforcement:false}]) assert.equal(canDemoChecklist(auth,"G453"),false);
  assert.equal(canDemoChecklist(demo,"Material supervisor · Olot"),false);
});
test("two-hour boundaries for 7, 8 and 9",()=>{
  for(const hour of [7,8,9]) {
    const start=new Date(2026,8,16,hour);
    assert.equal(inChecklistWindow(start,start),true);
    assert.equal(inChecklistWindow(start,new Date(+start+7199999)),true);
    assert.equal(inChecklistWindow(start,new Date(+start+7200000)),false);
    assert.equal(inChecklistWindow(start,new Date(+start-1)),false);
  }
});
test("completeness, issue and expiry statuses",()=>{
  assert.equal(checklistStatus(base),"Pendiente");
  assert.equal(checklistStatus({...base,phase:"closed"}),"No realizado");
  assert.throws(()=>completeDemo(base));
  const full={...base,answers:Object.fromEntries(DEMO_ITEMS.map(m=>[m,"ok"]))};
  assert.equal(checklistStatus(completeDemo(full)),"Correcto");
  const issue={...full,answers:{...full.answers,[DEMO_ITEMS[0]]:"issue"}};
  assert.equal(checklistStatus(completeDemo(issue)),"Incidencia");
  assert.throws(()=>completeDemo({...full,phase:"closed"}));
});
test("separate storage, idempotence, guard and zone isolation; corrupted data preserved",()=>{
  const store=memory(); store.setItem("cma_records","production");
  saveDemo(store,base); saveDemo(store,{...base,notes:{x:"note"}});
  assert.equal(readDemo(store).length,1);
  saveDemo(store,{...base,date:"2026-09-17"});
  saveDemo(store,{...base,zone:"Figueres"});
  assert.equal(readDemo(store).length,3); assert.equal(store.getItem("cma_records"),"production");
  assert.equal(filterDemo(readDemo(store),{zone:"Olot",from:base.date,to:base.date}).length,1);
  store.setItem(DEMO_KEY,"broken"); assert.throws(()=>saveDemo(store,base)); assert.equal(store.getItem(DEMO_KEY),"broken");
});
test("Excel roundtrip contains statuses, typed date, no formulas and separate warehouse sheets",()=>{
  const full=completeDemo({...base,answers:Object.fromEntries(DEMO_ITEMS.map(m=>[m,"ok"]))});
  const rows=[base,{...base,phase:"closed"},full,{...full,answers:{...full.answers,[DEMO_ITEMS[0]]:"issue"},notes:{[DEMO_ITEMS[0]]:"=danger"}},{...full,warehouse:"Banyoles",unit:"G413"}];
  const wb=buildChecklistWorkbook(XLSX,rows);
  assert.equal(wb.SheetNames.length,2);
  assert.equal(wb.Sheets[wb.SheetNames[0]].A6.t,"n");
  assert.equal(wb.Sheets[wb.SheetNames[0]].A7.s.fill.fgColor.rgb,"F8CDCD");
  const restored=XLSX.read(XLSX.write(wb,{type:"buffer",bookType:"xlsx"}),{type:"buffer"});
  assert.equal(restored.Sheets[restored.SheetNames[0]].C9.v,"Incidencia");
  assert.equal(restored.Sheets[restored.SheetNames[0]].H9.f,undefined);
});
test("demo implementation has no production data/network dependencies",()=>{
  for(const file of ["checklist-demo.mjs","ChecklistDemo.jsx","checklist-demo-export.mjs"]) {
    const source=fs.readFileSync(new URL(`../src/${file}`,import.meta.url),"utf8");
    assert.doesNotMatch(source,/supabase\s*\.|fetch\s*\(|\.rpc\s*\(|cma_records|warehouse_inventory/);
  }
});
