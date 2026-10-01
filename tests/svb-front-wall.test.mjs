import test from "node:test";
import assert from "node:assert/strict";
import {SVB_FRONT_WALL_SECTIONS,frontSectionItems,frontSectionStatus} from "../src/svb-front-wall-data.mjs";
test("the front wall defines every visual zone",()=>assert.deepEqual(SVB_FRONT_WALL_SECTIONS.map(({id})=>id),[1,2,3,4,5,6,7,8,9,10,11,12,13]));
test("the only undefined drawer cannot be completed accidentally",()=>assert.equal(frontSectionStatus(SVB_FRONT_WALL_SECTIONS.find((row)=>row.id===3),{}),"undefined"));
test("front drawers seven and eight contain their assigned material",()=>{
  assert.deepEqual(SVB_FRONT_WALL_SECTIONS.find(({id})=>id===7).items,["Bolsa para vómito · 10 unidades","Kit de vías · 1 unidad"]);
  assert.deepEqual(SVB_FRONT_WALL_SECTIONS.find(({id})=>id===8).items,["Suero fisiológico 500 ml · 4 unidades"]);
});
test("the first intervention bag keeps its internal groups",()=>{const section=SVB_FRONT_WALL_SECTIONS.find(({id})=>id===10);assert.ok(section.groups.length>=9);assert.ok(frontSectionItems(section).some((item)=>item.includes("Glucómetro")))});
test("front compartment two includes both SpCO sensors",()=>{const items=frontSectionItems(SVB_FRONT_WALL_SECTIONS.find(({id})=>id===2));assert.ok(items.includes("Sensor adulto SpCO · 1 unidad"));assert.ok(items.includes("Sensor pediátrico SpCO · 1 unidad"))});
test("front compartment two includes the pump support and adult mask number six",()=>{const section=SVB_FRONT_WALL_SECTIONS.find(({id})=>id===2);assert.ok(section.groups.find(({title})=>title==="Material general").items.includes("Soporte de bombas · 1 unidad"));assert.ok(section.groups.find(({title})=>title==="Bolsa de resucitación de adulto").items.includes("Mascarilla facial de adulto nº 6 · 1 unidad"))});
test("the first intervention adult resuscitation bag includes mask number six",()=>{const section=SVB_FRONT_WALL_SECTIONS.find(({id})=>id===10);assert.ok(section.groups.find(({title})=>title==="Bolsa de resucitación de adulto").items.includes("Mascarilla facial de adulto nº 6 · 1 unidad"))});
test("the gasas y bolsillos separator contains twenty small sterile gauzes",()=>{const section=SVB_FRONT_WALL_SECTIONS.find(({id})=>id===10);const group=section.groups.find(({title})=>title==="Separador: gasas y bolsillos");assert.ok(group.items.includes("Gasas estériles pequeñas · 20 unidades"));assert.equal(group.items.some((item)=>item.includes("pequeñas · 30 unidades")),false)});
test("every Guedel size requires three units while the respiratory filter stays at two",()=>{const items=SVB_FRONT_WALL_SECTIONS.find(({id})=>id===4).items;const guedels=items.filter((item)=>item.startsWith("Cánula Guedel"));assert.equal(guedels.length,8);assert.ok(guedels.every((item)=>item.endsWith("· 3 unidades")));assert.ok(items.includes("Filtro respiratorio · 2 unidades"))});
test("Schiller includes the daily user test",()=>assert.deepEqual(SVB_FRONT_WALL_SECTIONS.find(({id})=>id===13).items,["Prueba diaria de usuario realizada"]));
test("compartment nine includes the vacuum pump",()=>assert.ok(SVB_FRONT_WALL_SECTIONS.find(({id})=>id===9).items.includes("Bomba de vacío manual · 1 unidad")));
test("zone twelve contains immobilization material and two oxygen bottles",()=>assert.deepEqual(SVB_FRONT_WALL_SECTIONS.find(({id})=>id===12).items,["Tabla espinal","Camilla de cuchara","Botella de oxígeno · 2 unidades"]));
test("cervical material belongs to the bag behind Schiller",()=>{assert.equal(SVB_FRONT_WALL_SECTIONS.find(({id})=>id===3).items.length,0);assert.ok(SVB_FRONT_WALL_SECTIONS.find(({id})=>id===11).items.some((item)=>item.startsWith("Collarines multitalla de adulto")))});
