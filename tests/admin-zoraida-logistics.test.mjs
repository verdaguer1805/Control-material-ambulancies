import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {adminAccessLabel,canCorrectConsumption,canReadSystemStatus,canReadInoperability,canReadAdminReports,canReadAllReportZones} from '../src/admin-report-access.mjs';
test('Zoraida has owner capabilities with a separate display name',()=>{
 const z={role:'owner',display_name:'Zoraida'};
 assert.equal(adminAccessLabel(z),'Zoraida');
 for(const check of [canCorrectConsumption,canReadSystemStatus,canReadInoperability,canReadAdminReports,canReadAllReportZones])assert.equal(check(z),true);
 assert.equal(adminAccessLabel({role:'owner'}),'Propietario');
});
test('logistics loses only correction, status and inoperability; supervisor and reports viewer scopes preserved',()=>{
 const l={role:'logistics'};
 for(const check of [canCorrectConsumption,canReadSystemStatus,canReadInoperability])assert.equal(check(l),false);
 assert.equal(canReadAdminReports(l),true);assert.equal(canReadAllReportZones(l),true);
 assert.equal(canCorrectConsumption({role:'supervisor'}),true);
 assert.equal(canReadInoperability({role:'supervisor'}),true);
 assert.equal(canReadInoperability({role:'reports_viewer'}),true);
 assert.equal(canCorrectConsumption({role:'reports_viewer'}),false);
 for(const check of [canCorrectConsumption,canReadSystemStatus,canReadInoperability])assert.equal(check(null),false);
});
test('migration preserves rate limiting, identifies authenticated name, restricts server RPCs and avoids historical stock edits',()=>{
 const sql=fs.readFileSync(new URL('../sql/admin-zoraida-logistics-v1.sql',import.meta.url),'utf8');
 assert.match(sql,/check_access_attempt\('admin',input_code\)/);
 assert.match(sql,/if not coalesce.*authorized.*return result/);
 assert.match(sql,/extensions.crypt\(p_code,extensions.gen_salt\('bf'\)\)/);
 assert.match(sql,/where access_key='zoraida'/);
 assert.match(sql,/correct_tsnu_consumption\(uuid,text,text,integer,integer,text\)/);
 assert.match(sql,/logistics_restricted_v1/);
 assert.match(sql,/before insert on public.stock_movements/);
 assert.doesNotMatch(sql,/(update|delete from) public\.(stock_movements|warehouse_inventory|device_authorizations)/i);
 const ui=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
 assert.match(ui,/canCorrectConsumption\(adminAccess\) && <button/);
 assert.match(ui,/canReadInoperability\(adminAccess\) && <button/);
 assert.match(ui,/systemStatusOpen && canReadSystemStatus/);
 assert.match(ui,/row.performed_name \|\|/);
});
