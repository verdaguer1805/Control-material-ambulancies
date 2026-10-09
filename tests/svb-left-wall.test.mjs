import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { auditItems } from "../src/vehicle-audit.mjs";
import { SVB_LEFT_WALL_SECTIONS, sectionStatus, leftRequiredSections } from "../src/svb-left-wall-data.mjs";

test("anticorte gloves are a single three-pair entry and signaling cones are removed",()=>{
  assert.deepEqual(SVB_LEFT_WALL_SECTIONS.find(({id})=>id===3).items.filter(item=>item.startsWith("Guantes anticorte")),["Guantes anticorte · 3 pares"]);
  assert.ok(SVB_LEFT_WALL_SECTIONS.every(section=>section.items.every(item=>!item.startsWith("Conos"))));
});

test("the real left wall includes the new aspirator compartment",()=>{
  assert.deepEqual(SVB_LEFT_WALL_SECTIONS.map(({id})=>id),[1,2,3,4,5,7,8,9,10,11]);
  assert.ok(SVB_LEFT_WALL_SECTIONS.every(({items})=>items.length>0));
});

test("aspirator is required for unsent and new guards but confirmed historical checklists are preserved",()=>{
  assert.ok(leftRequiredSections(SVB_LEFT_WALL_SECTIONS,{},false).some(s=>s.id===11));
  assert.ok(!leftRequiredSections(SVB_LEFT_WALL_SECTIONS,{},true).some(s=>s.id===11));
  assert.ok(leftRequiredSections(SVB_LEFT_WALL_SECTIONS,{11:{Aspirador:'issue'}},true).some(s=>s.id===11));
});

test("new compartment ten contains the splint bag with printed quantities",()=>{
  const bag=SVB_LEFT_WALL_SECTIONS.find(({id})=>id===10);
  assert.equal(bag.title,"Bolsa de férulas");
  assert.deepEqual(bag.items,["Férula Kramer (hierro + funda) · 3 unidades","Férula maleable digital · 2 unidades","Férula maleable braquial · 2 unidades"]);
  assert.equal(sectionStatus(bag,{}),"pending");
});

test("left blanket and complete Kramer set use the same labels in unit checks and audits",()=>{
 const blanket="Manta térmica · 1 unidad",kramer="Férula Kramer (hierro + funda) · 3 unidades";
 assert.ok(SVB_LEFT_WALL_SECTIONS.find(s=>s.id===7).items.includes(blanket));
 assert.ok(SVB_LEFT_WALL_SECTIONS.find(s=>s.id===7).items.includes("Caja de pañuelos"));
 assert.ok(!SVB_LEFT_WALL_SECTIONS.find(s=>s.id===7).items.includes("Toallas de papel"));
 assert.ok(!SVB_LEFT_WALL_SECTIONS.find(s=>s.id===7).items.some(item=>/manta.*neonatal/i.test(item)));
 for(const file of ['public/checklists/svb-left-wall-data.js','public/svb-preview.html']){
  const text=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
  assert.ok(text.includes(blanket));assert.ok(text.includes(kramer));
  assert.ok(text.includes("Caja de pañuelos"));assert.ok(!text.includes("Toallas de papel"));
  assert.ok(!text.includes('Funda para férula Kramer · 3 unidades'));
 }
 const labels=auditItems('SVB').map(item=>item.label);
 assert.ok(labels.includes(blanket));assert.ok(labels.includes(kramer));
 assert.ok(labels.includes("Caja de pañuelos"));
});

test("aspirator contents follow the printed list without the vacuum connector",()=>{
 const section=SVB_LEFT_WALL_SECTIONS.find(s=>s.id===11);
 assert.equal(section.items.length,10);
 assert.ok(section.items.every(item=>item.endsWith('· 1 unidad')));
 assert.ok(section.items.includes('Conexión en Y · 1 unidad'));
 assert.ok(section.items.every(item=>!item.toLowerCase().includes('connector')&&!item.toLowerCase().includes('vacío')));
 const probes=section.items.filter(item=>item.startsWith('Sonda'));
 assert.deepEqual(probes.map(item=>Number(item.match(/nº (\d+)/)[1])),[6,8,10,14,16,18]);
 const historic=leftRequiredSections(SVB_LEFT_WALL_SECTIONS,{11:{Aspirador:'issue'}},true).find(s=>s.id===11);
 assert.equal(sectionStatus(historic,{11:{Aspirador:'issue'}}),'issue');
 assert.equal(sectionStatus(section,{11:{Aspirador:'ok'}}),'pending');
});

test("the physical fifth drawer keeps loose material and details the IMA bag",()=>{
  const drawer=SVB_LEFT_WALL_SECTIONS.find(({id})=>id===5);
  assert.ok(drawer.items.some(item=>item.startsWith("Cadenas de nieve")));
  assert.ok(drawer.items.some(item=>item.startsWith("Spray verde")));
  assert.ok(drawer.items.includes("Bolsa IMA"));
  assert.equal(drawer.items.filter(item=>item.startsWith("Bolsa IMA —")).length,10);
  assert.ok(drawer.items.includes("Bolsa IMA — Lanyards verdes · 20 unidades"));
  assert.equal(drawer.items.includes("Torniquete"),false);
  assert.equal(drawer.items.filter(item=>item.includes("Lanyards")).length,4);
  assert.equal(SVB_LEFT_WALL_SECTIONS.some(({id})=>id===6),false);
});

test("updated left contents exclude shoe covers and include three Yankauer and adult cuff",()=>{
  assert.ok(!SVB_LEFT_WALL_SECTIONS.find(({id})=>id===2).items.some(item=>item.startsWith("Cubrebotas")));
  assert.ok(!auditItems('SVB').some(item=>item.section.startsWith('Zona izquierda')&&item.label.startsWith('Cubrebotas')));
  assert.ok(SVB_LEFT_WALL_SECTIONS.find(({id})=>id===2).items.includes("Gafas de protección · 3 unidades"));
  assert.ok(SVB_LEFT_WALL_SECTIONS.find(({id})=>id===9).items.includes("Canula Yankauer · 3 unidades"));
  assert.ok(SVB_LEFT_WALL_SECTIONS.find(({id})=>id===8).items.includes("Manguito adulto 42–57 cm para tensiómetro · 1 unidad"));
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
