import test from 'node:test';import assert from 'node:assert/strict';
import {resolveDemoAssignment,assignDemo,CHECKLIST_OPTIONS} from '../src/checklist-assignment-demo.mjs';
const legacy={unit:'G453',lot:'Lot5',zone:'Olot',warehouse:'Camprodon',shift:'07:00',authorized:true};
test('legacy TSU preserves assignment and authorization without forcing checklist',()=>{const r=resolveDemoAssignment(legacy);for(const k of Object.keys(legacy))assert.equal(r[k],legacy[k]);assert.equal(r.service,'TSU');assert.equal(r.canConsume,true);assert.equal(r.checklist,'');});
test('TSU has three compatible checklist types',()=>{assert.equal(CHECKLIST_OPTIONS.TSU.length,3);for(const checklist of CHECKLIST_OPTIONS.TSU)assert.equal(assignDemo({...legacy,service:'TSU',checklist}).canConsume,true);});
test('TSNU has one automatic checklist and no production consumption',()=>{const r=assignDemo({...legacy,service:'TSNU'});assert.equal(r.checklist,'TSNU');assert.equal(r.canConsume,false);assert.throws(()=>assignDemo({...legacy,service:'TSNU',checklist:'Polivalente'}));});
test('invalid or incomplete assignments fail closed',()=>{assert.throws(()=>assignDemo(legacy));assert.throws(()=>assignDemo({...legacy,service:'bad'}));assert.throws(()=>assignDemo({...legacy,service:'TSNU',unit:''}));});
test('TSNU requires no shift and strips legacy shift; TSU still requires it',()=>{
 assert.equal(assignDemo({...legacy,service:'TSNU',shift:undefined}).shift,'');
 assert.equal(resolveDemoAssignment({...legacy,service:'TSNU'}).shift,'');
 assert.throws(()=>assignDemo({...legacy,service:'TSU',checklist:'TSU',shift:''}));
});
