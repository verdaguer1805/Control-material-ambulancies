import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {auditorRegistrationLabel} from '../src/auditor-client.mjs';
test('auditor registration uses actual server timestamp in Madrid time, summer and winter',()=>{
 assert.equal(auditorRegistrationLabel('2026-11-09T10:54:21Z'),'09/11/2026 11:54:21');
 assert.equal(auditorRegistrationLabel('2026-07-09T10:54:21Z'),'09/07/2026 12:54:21');
 assert.equal(auditorRegistrationLabel('2026-11-09T23:30:00Z'),'10/11/2026 00:30:00');
 for(const value of [null,undefined,'','invalid'])assert.equal(auditorRegistrationLabel(value),'Sin fecha registrada');
});
test('admin displays original phone registration without inventing last-login dates or expanding access',()=>{
 const ui=fs.readFileSync(new URL('../src/AuditorManager.jsx',import.meta.url),'utf8');
 const sql=fs.readFileSync(new URL('../sql/named-auditors-v1.sql',import.meta.url),'utf8');
 assert.match(ui,/<th>Alta del móvil<\/th>/);
 assert.match(ui,/auditorRegistrationLabel\(row.created_at\)/);
 assert.match(ui,/\['owner','supervisor'\].includes\(access\?\.role\)/);
 assert.match(sql,/jsonb_agg\(to_jsonb\(p\)/);
});
