import test from "node:test";
import assert from "node:assert/strict";
import {SVB_FRONT_WALL_SECTIONS,frontSectionItems,frontSectionStatus,frontRequiredSections} from "../src/svb-front-wall-data.mjs";
test("front oxygen quantities and corrected trauma material follow the new configuration",()=>{
  const items=id=>frontSectionItems(SVB_FRONT_WALL_SECTIONS.find(row=>row.id===id));
  assert.ok(!items(1).some(item=>item.includes("PEEP")));
  assert.ok(items(5).includes("Mascarilla de oxígeno de adulto · 4 unidades"));
  assert.ok(items(5).includes("Mascarilla de oxígeno de adulto con reservorio · 4 unidades"));
  assert.equal(items(5).length,2);
  assert.ok(items(7).includes("Mascarilla nebulizadora adulta · 1 unidad"));
  assert.ok(items(7).includes("Gafas nasales · 4 unidades"));
  assert.ok(items(6).includes("Mascarilla de oxígeno pediátrica · 2 unidades"));
  assert.ok(items(6).includes("Gafas nasales pediátricas · 1 unidad"));
  assert.ok(items(6).includes("Mascarilla nebulizadora pediátrica · 1 unidad"));
  assert.ok(items(10).includes("Inmovilizador de hombro · 1 unidad"));
  assert.ok(!items(10).some(item=>item.includes("espátula")));
});
test("front burns kit includes all nine supplied materials with one unit each",()=>{
  const section=SVB_FRONT_WALL_SECTIONS.find(({id})=>id===2);
  const kit=section.groups.find(({title})=>title==="Kit de quemados");
  assert.equal(kit.items.length,9);
  for(const size of ["10 × 10","20 × 20","20 × 45"])assert.ok(kit.items.some(item=>item.includes(size)));
  assert.ok(kit.items.every(item=>item.endsWith("· 1 unidad")||item.endsWith("· 1 par")));
  assert.ok(kit.items.some(item=>item.includes("talla L · 1 par")));
  assert.equal(section.groups.find(({title})=>title==="Material general").items.some(item=>item.startsWith("Kit de quemados")),false);
});
test("the front wall defines every visual zone",()=>assert.deepEqual(SVB_FRONT_WALL_SECTIONS.map(({id})=>id),[1,2,3,4,5,6,7,8,9,10,11,12,13]));
test("drawer three requires the SEM report block, except in already confirmed legacy checklists",()=>{
 const section=SVB_FRONT_WALL_SECTIONS.find(row=>row.id===3);
 assert.deepEqual(section.items,["Partes SEM · 1 bloc"]);
 assert.equal(frontSectionStatus(section,{}),"pending");
 assert.ok(frontRequiredSections(SVB_FRONT_WALL_SECTIONS,{},false).some(s=>s.id===3));
 assert.ok(!frontRequiredSections(SVB_FRONT_WALL_SECTIONS,{},true).some(s=>s.id===3));
 assert.ok(frontRequiredSections(SVB_FRONT_WALL_SECTIONS,{3:{"Partes SEM · 1 bloc":"ok"}},true).some(s=>s.id===3));
});
test("front drawers seven and eight contain their assigned material",()=>{
  assert.deepEqual(SVB_FRONT_WALL_SECTIONS.find(({id})=>id===7).items,["Bolsa para vómito · 10 unidades","Kit de vías · 1 unidad","Gafas nasales · 4 unidades","Mascarilla nebulizadora adulta · 1 unidad"]);
  assert.deepEqual(SVB_FRONT_WALL_SECTIONS.find(({id})=>id===8).items,["Suero fisiológico 500 ml · 2 unidades"]);
});
test("the first intervention bag keeps its internal groups",()=>{const section=SVB_FRONT_WALL_SECTIONS.find(({id})=>id===10);assert.ok(section.groups.length>=9);assert.ok(frontSectionItems(section).some((item)=>item.includes("Glucómetro")))});
test("front compartment two includes both SpCO sensors",()=>{const items=frontSectionItems(SVB_FRONT_WALL_SECTIONS.find(({id})=>id===2));assert.ok(items.includes("Sensor adulto SpCO · 1 unidad"));assert.ok(items.includes("Sensor pediátrico SpCO · 1 unidad"))});
test("front compartment two includes the pump support and adult mask number six",()=>{const section=SVB_FRONT_WALL_SECTIONS.find(({id})=>id===2);assert.ok(section.groups.find(({title})=>title==="Material general").items.includes("Soporte de bombas · 1 unidad"));assert.ok(section.groups.find(({title})=>title==="Bolsa de resucitación de adulto").items.includes("Mascarilla facial de adulto nº 6 · 1 unidad"))});
test("the first intervention adult resuscitation bag includes mask number six",()=>{const section=SVB_FRONT_WALL_SECTIONS.find(({id})=>id===10);assert.ok(section.groups.find(({title})=>title==="Bolsa de resucitación de adulto").items.includes("Mascarilla facial de adulto nº 6 · 1 unidad"))});
test("the gasas y bolsillos separator contains twenty small sterile gauzes",()=>{const section=SVB_FRONT_WALL_SECTIONS.find(({id})=>id===10);const group=section.groups.find(({title})=>title==="Separador: gasas y bolsillos");assert.ok(group.items.includes("Gasas estériles pequeñas · 20 unidades"));assert.equal(group.items.some((item)=>item.includes("pequeñas · 30 unidades")),false)});
test("Guedel 00, 0 and 1 require two units, other sizes three and filter two",()=>{const items=SVB_FRONT_WALL_SECTIONS.find(({id})=>id===4).items;for(const size of ["00","0","1"])assert.ok(items.includes(`Cánula Guedel nº ${size} · 2 unidades`));for(const size of ["1,5","2","3","4","5"])assert.ok(items.includes(`Cánula Guedel nº ${size} · 3 unidades`));assert.ok(items.includes("Filtro respiratorio · 2 unidades"))});
test("capelina is removed from all front checklist compartments",()=>{assert.ok(SVB_FRONT_WALL_SECTIONS.every(section=>frontSectionItems(section).every(item=>!item.includes("capelina"))))});
test("Schiller includes the daily user test and the monitor contents including neonatal cuff",()=>{
  const items=SVB_FRONT_WALL_SECTIONS.find(({id})=>id===13).items;
  assert.equal(items.length,12);
  assert.ok(items.includes("Prueba diaria de usuario realizada"));
  assert.ok(items.includes("Electrodos de monitorización · 1 bolsa"));
  assert.ok(items.includes("Parche de desfibrilación de adulto Schiller · 2 unidades"));
  assert.ok(items.includes("Manguito de tensión arterial neonatal · 1 unidad"));
  assert.equal(items.filter(item=>item.startsWith("Manguito")).length,4);
});
test("compartment nine includes the vacuum pump",()=>assert.ok(SVB_FRONT_WALL_SECTIONS.find(({id})=>id===9).items.includes("Bomba de vacío manual · 1 unidad")));
test("zone twelve contains immobilization material and two oxygen bottles",()=>assert.deepEqual(SVB_FRONT_WALL_SECTIONS.find(({id})=>id===12).items,["Tabla espinal","Camilla de cuchara","Botella de oxígeno · 2 unidades"]));
test("cervical material belongs to the bag behind Schiller",()=>{assert.ok(!SVB_FRONT_WALL_SECTIONS.find(({id})=>id===3).items.some(item=>item.startsWith("Collarines")));assert.ok(SVB_FRONT_WALL_SECTIONS.find(({id})=>id===11).items.some((item)=>item.startsWith("Collarines multitalla de adulto")))});
