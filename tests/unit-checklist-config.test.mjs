import test from 'node:test';
import assert from 'node:assert/strict';
import {validateUnitChecklist,readUnitChecklist,UNIT_CHECKLIST_KEY,TSU_CHECKLISTS,TSNU_UNITS,tsnuWarehouse} from '../src/unit-checklist-config.mjs';
const base={service:'TSU', checklist:'SVB', unit:'G453', lot:'Lot 5', zone:'Olot', shift:'07:00'};
test('only the three approved legacy mobiles default to SVB without writing settings',()=>{
 const lot='Lot 5 · Girona - Alt Maresme';
 const storage={getItem:()=>null,setItem:()=>assert.fail('must not modify authorization, shift or assignment')};
 for (const unit of ['G452','G413','G453']) {
  assert.deepEqual(readUnitChecklist(storage,unit,lot),{unit,lot,zone:'Olot',service:'TSU',checklist:'SVB'});
 }
 assert.equal(readUnitChecklist(storage,'G451',lot).checklist,'');
 assert.equal(readUnitChecklist(storage,'G453','Lot 7').checklist,'');
 const explicit={...base,lot,checklist:'Polivalente'};
 assert.equal(readUnitChecklist({getItem:()=>JSON.stringify(explicit)},'G453',lot).checklist,'Polivalente');
});
test('new TSU requires an approved checklist, matching unit and valid shift',()=>{
 for (const checklist of TSU_CHECKLISTS) assert.equal(validateUnitChecklist({...base,checklist},{G453:'Camprodon'}).checklist,checklist);
 for (const change of [{service:''},{checklist:''},{shift:''},{unit:'wrong'}]) assert.throws(()=>validateUnitChecklist({...base,...change},{G453:'Camprodon'}));
});
test('legacy assignments are read as TSU without modifying storage',()=>{
 const storage={getItem:()=>null,setItem:()=>assert.fail('must not write')};
 assert.deepEqual(readUnitChecklist(storage,'G413','lot'),{unit:'G413',lot:'lot',service:'TSU',checklist:''});
});
test('saved checklist reloads only for matching lot and unit',()=>{
 const storage={getItem:key=>key===UNIT_CHECKLIST_KEY?JSON.stringify(base):null};
 assert.equal(readUnitChecklist(storage,'G453','Lot 5').checklist,'SVB');
 assert.equal(readUnitChecklist(storage,'G413','Lot 5').checklist,'');
 assert.equal(readUnitChecklist(storage,'G453','Lot 7').checklist,'');
});
test('supervisor material keeps no shift and no checklist',()=>{
 const result=validateUnitChecklist({...base,unit:'super',supervisor:true,checklist:'',shift:''},{super:'Material supervisor'});
 assert.equal(result.shift,'');assert.equal(result.checklist,'');
});
test('TSNU cannot accidentally select an existing TSU unit',()=>{
 assert.throws(()=>validateUnitChecklist({...base,service:'TSNU'},{G453:'Camprodon'}));
});
test('all 19 Olot TSNU units have automatic checklist and no shift',()=>{
 const lot='Lot 5 · Girona - Alt Maresme';
 const units=TSNU_UNITS[lot].Olot;
 assert.equal(Object.keys(units).length,19);
 assert.equal(units.KE1388,'TSNU');
 for(const unit of Object.keys(units)) {
  const result=validateUnitChecklist({...base,unit,lot,service:'TSNU',checklist:'',shift:''},units);
  assert.equal(result.checklist,'TSNU');assert.equal(result.shift,'');
  assert.equal(readUnitChecklist({getItem:()=>JSON.stringify(result)},unit,lot).service,'TSNU');
 }
 assert.throws(()=>validateUnitChecklist({...base,unit:'T1731',lot,zone:'Figueres',service:'TSNU'},units));
});
test('TSNU warehouse mapping is scoped and does not alter central minimum weights',()=>{
 const lot='Lot 5 · Girona - Alt Maresme';
 assert.equal(tsnuWarehouse('T1731',lot,'Olot'),'Campdevànol');
 assert.equal(tsnuWarehouse('T1744',lot,'Olot'),'Olot');
 assert.equal(tsnuWarehouse('T1731',lot,'Figueres'),'');
});
