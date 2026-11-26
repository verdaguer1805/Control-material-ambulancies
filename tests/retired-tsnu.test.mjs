import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TSNU_UNITS,deviceServiceLabel,managedDeviceZone,validateUnitChecklist} from '../src/unit-checklist-config.mjs';
const lot='Lot 5 · Girona - Alt Maresme';
test('retired T1741 cannot be assigned but keeps historical service and zone',()=>{
 assert.equal(TSNU_UNITS[lot].Olot.T1741,undefined);
 assert.equal(deviceServiceLabel('T1741',lot),'TSNU · Solo checklist');
 assert.equal(managedDeviceZone({lot,unit:'T1741'},{[lot]:{Olot:{}}}),'Olot');
 assert.equal(managedDeviceZone({lot:'Other lot',unit:'T1741'},{[lot]:{Olot:{}}}),'');
 assert.throws(()=>validateUnitChecklist({service:'TSNU',lot,zone:'Olot',unit:'T1741'},TSNU_UNITS[lot].Olot));
});
test('retirement preserves history and report reads submitted shifts independently of active roster',()=>{
 const sql=fs.readFileSync(new URL('../sql/retire-t1741-olot.sql',import.meta.url),'utf8');
 assert.doesNotMatch(sql,/\bdelete\b|\btruncate\b|\bdrop\b/i);
 assert.doesNotMatch(sql,/update public\.tsnu_shift_sessions/i);
 const reports=fs.readFileSync(new URL('../sql/admin-tsnu-reports-v1.sql',import.meta.url),'utf8');
 assert.match(reports,/from public\.tsnu_shift_sessions s/);assert.doesNotMatch(reports,/t\.active/);
});
