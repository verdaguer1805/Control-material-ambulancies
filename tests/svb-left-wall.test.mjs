import test from "node:test";
import assert from "node:assert/strict";
import { SVB_LEFT_WALL_SECTIONS, sectionStatus } from "../src/svb-left-wall-data.mjs";

test("anticorte gloves are a single three-pair entry and signaling cones are removed",()=>{
  assert.deepEqual(SVB_LEFT_WALL_SECTIONS.find(({id})=>id===3).items.filter(item=>item.startsWith("Guantes anticorte")),["Guantes anticorte · 3 pares"]);
  assert.ok(SVB_LEFT_WALL_SECTIONS.every(section=>section.items.every(item=>!item.startsWith("Conos"))));
});

test("the real left wall defines its eight independent compartments",()=>{
  assert.deepEqual(SVB_LEFT_WALL_SECTIONS.map(({id})=>id),[1,2,3,4,5,7,8,9]);
  assert.ok(SVB_LEFT_WALL_SECTIONS.every(({items})=>items.length>0));
});

test("the physical fifth drawer keeps loose material and hides only the IMA bag contents",()=>{
  const drawer=SVB_LEFT_WALL_SECTIONS.find(({id})=>id===5);
  assert.ok(drawer.items.some(item=>item.startsWith("Cadenas de nieve")));
  assert.ok(drawer.items.some(item=>item.startsWith("Spray verde")));
  assert.ok(drawer.items.includes("Bolsa IMA"));
  assert.equal(drawer.items.includes("Torniquete"),false);
  assert.equal(drawer.items.some(item=>item.includes("Lanyards")),false);
  assert.equal(SVB_LEFT_WALL_SECTIONS.some(({id})=>id===6),false);
});

test("compartment four includes the pediatric vacuum mattress",()=>{
  assert.ok(SVB_LEFT_WALL_SECTIONS.find(({id})=>id===4).items.includes("Colchón de vacío pediátrico · 1 unidad"));
});

test("every controlled aspiration probe in compartment nine requires two units",()=>{
  const compartment=SVB_LEFT_WALL_SECTIONS.find(({id})=>id===9);
  const probes=compartment.items.filter(item=>item.startsWith("Sonda de aspiracion"));
  assert.equal(probes.length,7);
  assert.equal(compartment.items.includes("Filtro para aspirador LSU"),false);
  assert.ok(probes.every(item=>item.endsWith("2 unidades")));
});

test("a compartment becomes green only when every item is correct",()=>{
  const section=SVB_LEFT_WALL_SECTIONS[0];
  assert.equal(sectionStatus(section,{}),"pending");
  assert.equal(sectionStatus(section,{1:{[section.items[0]]:"ok"}}),"pending");
  assert.equal(sectionStatus(section,{1:Object.fromEntries(section.items.map(item=>[item,"ok"]))}),"ok");
});

test("a completed compartment with any incidence becomes red",()=>{
  const section=SVB_LEFT_WALL_SECTIONS[1];
  const values=Object.fromEntries(section.items.map(item=>[item,"ok"]));
  values[section.items.at(-1)]="issue";
  assert.equal(sectionStatus(section,{2:values}),"issue");
});
