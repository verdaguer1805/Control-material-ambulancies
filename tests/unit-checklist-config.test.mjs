import test from 'node:test';
import assert from 'node:assert/strict';
import {validateUnitChecklist,readUnitChecklist,UNIT_CHECKLIST_KEY,TSU_CHECKLISTS,TSNU_UNITS} from '../src/unit-checklist-config.mjs';
const base={service:'TSU', checklist:'SVB', unit:'G453', lot:'Lot 5', zone:'Olot', shift:'07:00'};
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
test('all 18 Olot TSNU units have automatic checklist and no shift',()=>{
 const lot='Lot 5 · Girona - Alt Maresme';
 const units=TSNU_UNITS[lot].Olot;
 assert.equal(Object.keys(units).length,18);
 for(const unit of Object.keys(units)) {
  const result=validateUnitChecklist({...base,unit,lot,service:'TSNU',checklist:'',shift:''},units);
  assert.equal(result.checklist,'TSNU');assert.equal(result.shift,'');
  assert.equal(readUnitChecklist({getItem:()=>JSON.stringify(result)},unit,lot).service,'TSNU');
 }
 assert.throws(()=>validateUnitChecklist({...base,unit:'T1731',lot,zone:'Figueres',service:'TSNU'},units));
});
