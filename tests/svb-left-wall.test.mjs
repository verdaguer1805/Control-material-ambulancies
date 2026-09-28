import test from "node:test";
import assert from "node:assert/strict";
import { SVB_LEFT_WALL_SECTIONS, sectionStatus } from "../src/svb-left-wall-data.mjs";

test("the real left wall defines its eight independent compartments",()=>{
  assert.deepEqual(SVB_LEFT_WALL_SECTIONS.map(({id})=>id),[1,2,3,4,5,7,8,9]);
  assert.ok(SVB_LEFT_WALL_SECTIONS.every(({items})=>items.length>0));
});

test("the physical fifth drawer contains the former fifth and sixth lists",()=>{
  const drawer=SVB_LEFT_WALL_SECTIONS.find(({id})=>id===5);
  assert.ok(drawer.items.includes("Cadenas de nieve"));
  assert.ok(drawer.items.includes("Esparadrapo verde"));
  assert.equal(SVB_LEFT_WALL_SECTIONS.some(({id})=>id===6),false);
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
