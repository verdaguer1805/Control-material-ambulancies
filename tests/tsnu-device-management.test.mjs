import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TSNU_UNITS,deviceServiceLabel} from '../src/unit-checklist-config.mjs';
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
 assert.match(source,/authorizedDevices\.map\(\(device\)/);
 assert.match(source,/supabase\.rpc\("activate_device"/);
 assert.match(source,/supabase\.rpc\("revoke_authorized_device_for_admin"/);
});
