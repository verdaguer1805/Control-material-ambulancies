import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {auditorRegistrationLabel} from '../src/auditor-client.mjs';
import {auditorLastAuthorization} from '../src/auditor-admin.mjs';
test('auditor registration uses actual server timestamp in Madrid time, summer and winter',()=>{
 assert.equal(auditorRegistrationLabel('2026-11-09T10:54:21Z'),'09/11/2026 11:54:21');
 assert.equal(auditorRegistrationLabel('2026-07-09T10:54:21Z'),'09/07/2026 12:54:21');
 assert.equal(auditorRegistrationLabel('2026-11-09T23:30:00Z'),'10/11/2026 00:30:00');
 for(const value of [null,undefined,'','invalid'])assert.equal(auditorRegistrationLabel(value),'Sin fecha registrada');
});
test('admin displays only latest authorization, never first registration or last-login as a fallback',()=>{
 const ui=fs.readFileSync(new URL('../src/AuditorManager.jsx',import.meta.url),'utf8');
 const sql=fs.readFileSync(new URL('../sql/named-auditors-v1.sql',import.meta.url),'utf8');
 assert.doesNotMatch(ui,/<th>(Primera alta|Alta del móvil)<\/th>/);
 assert.match(ui,/<th>Última autorización<\/th>/);
 assert.match(ui,/auditorRegistrationLabel\(auditorLastAuthorization\(row\)\)/);
 assert.doesNotMatch(ui,/row\.(created_at|updated_at)/);
 assert.equal(auditorLastAuthorization({created_at:'2026-10-01',updated_at:'2026-11-27'}),null);
 assert.equal(auditorLastAuthorization({created_at:'2026-10-01',updated_at:'2026-11-28',last_authorized_at:'2026-11-27T12:00:00Z'}),'2026-11-27T12:00:00Z');
 assert.match(ui,/\['owner','supervisor'\].includes\(access\?\.role\)/);
 assert.match(sql,/jsonb_agg\(to_jsonb\(p\)/);
});
