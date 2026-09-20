import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../sql/device-authorization-audit.sql',import.meta.url),'utf8');
const source=readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');

test('device authorization events are private, server-authored and owner-readable',()=>{
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on public\.device_authorization_audit from public, anon, authenticated/);
 assert.match(sql,/admin_has_role\(array\['owner'\]\)/);
 assert.match(sql,/manual_revocation/);
 assert.match(sql,/automatic_replacement/);
 assert.match(sql,/actor_user_id/);
});

test('admin exposes a separate authorization history without mixing active devices',()=>{
 assert.match(source,/list_device_authorization_audit_for_admin/);
 assert.match(source,/Historial de autorizaciones/);
 assert.match(source,/Volver a dispositivos/);
});
