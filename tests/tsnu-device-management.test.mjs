import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TSNU_UNITS,deviceServiceLabel,filterManagedDevices} from '../src/unit-checklist-config.mjs';
test('all configured TSNU devices are identifiable without changing authorization',()=>{
 for(const [lot,zones] of Object.entries(TSNU_UNITS)) for(const units of Object.values(zones)) for(const unit of Object.keys(units)) assert.equal(deviceServiceLabel(unit,lot),'TSNU · Solo checklist');
 assert.equal(deviceServiceLabel('G453','Lot 5 · Girona - Alt Maresme'),'TSU / Material');
 assert.equal(deviceServiceLabel('T1731','Lot 7'),'TSU / Material');
});
test('TSNU shares activation/revocation UI but remains excluded from consumption',()=>{
 const source=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
 assert.doesNotMatch(source,/currentChecklistConfig\.service !== 'TSNU' && deviceAuth\.checked/);
 assert.match(source,/\{deviceAuth\.checked && deviceAuth\.enforcement && \(/);
 assert.match(source,/currentChecklistConfig\.service !== 'TSNU' && <>/);
 assert.match(source,/visibleDevices\.map\(\(device\)/);
 assert.match(source,/supabase\.rpc\("activate_device"/);
 assert.match(source,/supabase\.rpc\("revoke_authorized_device_for_admin"/);
});
test('service filters hide revoked by default without deleting records',()=>{
 const lot='Lot 5 · Girona - Alt Maresme';
 const rows=[{unit:'G453',lot,active:true},{unit:'T1731',lot,active:true},{unit:'T1732',lot,active:false}];
 assert.equal(filterManagedDevices(rows).length,2);
 assert.deepEqual(filterManagedDevices(rows,'TSNU').map(r=>r.unit),['T1731']);
 assert.deepEqual(filterManagedDevices(rows,'TSU').map(r=>r.unit),['G453']);
 assert.equal(filterManagedDevices(rows,'TSNU',true).length,2);
 assert.equal(rows.length,3);
});
test('lot and zone filters intersect with service and revocation filters',()=>{
 const lot='Lot 5 · Girona - Alt Maresme';
 const lots={[lot]:{Olot:{G453:'Camprodon'},Figueres:{G206:'Figueres'}},'Lot 7':{Olot:{G453:'Other'}}};
 const rows=[{unit:'G453',lot,active:true},{unit:'T1731',lot,active:true},{unit:'G206',lot,active:true},{unit:'G453',lot:'Lot 7',active:true},{unit:'T1732',lot,active:false}];
 assert.deepEqual(filterManagedDevices(rows,'all',false,{lot,zone:'Olot'},lots).map(r=>r.unit),['G453','T1731']);
 assert.deepEqual(filterManagedDevices(rows,'TSNU',false,{lot,zone:'Figueres'},lots),[]);
 assert.equal(filterManagedDevices(rows,'TSNU',true,{lot,zone:'Olot'},lots).length,2);
 assert.equal(filterManagedDevices(rows,'all',false,{lot:'Lot 7',zone:'Olot'},lots).length,1);
});
