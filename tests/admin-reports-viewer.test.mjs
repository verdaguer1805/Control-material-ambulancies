import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {isReportsOnlyAccess,canReadAllReportZones,canReadAdminReports,adminAccessLabel} from '../src/admin-report-access.mjs';
import {canAccessWarehouseScope} from '../src/warehouse-config.mjs';
test('Picornell solo informes de todos los ámbitos, no almacenes',()=>{
 const access={role:'reports_viewer'};
 assert.equal(isReportsOnlyAccess(access),true);assert.equal(canReadAllReportZones(access),true);assert.equal(canReadAdminReports(access),true);
 assert.equal(adminAccessLabel(access),'SOTS-CAP PICORNELL');
 for(const lot of ['Lot A','Lot B'])for(const zone of ['Olot','Figueres','Girona','Blanes'])assert.equal(canAccessWarehouseScope(access,{lot,zone}),false);
 assert.equal(canReadAllReportZones({role:'supervisor',zone:'Olot'}),false);assert.equal(isReportsOnlyAccess({role:'owner'}),false);
});
test('la interfaz separa informe global de gestión; código secreto no en cliente',()=>{
 const source=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
 assert.match(source,/adminCanAccessAllReportZones \|\| zone === adminAccess\?\.zone/);
 assert.match(source,/stockDemoOpen && !adminReportOnly/);assert.match(source,/correctionOpen && !adminReportOnly/);
 assert.match(source,/!adminReportOnly && <button className="secondary" onClick=\{openConsumptionCorrection\}/);
 const sql=fs.readFileSync(new URL('../sql/admin-reports-viewer-v1.sql',import.meta.url),'utf8');
 assert.doesNotMatch(sql,/create or replace function public\.admin_can_access_zone/);
 assert.doesNotMatch(sql,/create or replace function public\.admin_has_role/);
 assert.doesNotMatch(sql,/create or replace function public\.open_admin_access_session/);
 assert.match(sql,/REPORT_RPC_MISSING/);assert.match(sql,/extensions\.crypt/);
 assert.match(fs.readFileSync(new URL('../.gitignore',import.meta.url),'utf8'),/tmp\/admin-reports-viewer-credentials.sql/);
});
test('ambos botones juntos, inoperatividades destacado en rojo y formulario controlado sin ampliar permisos',()=>{
 const source=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
 const toolbar=source.slice(source.indexOf('<div className="admin-report-actions">'),source.indexOf('{!adminReportOnly && <button className="secondary" onClick={openConsumptionCorrection}'));
 assert.match(toolbar,/Descargar informe/);assert.match(toolbar,/Informe de inoperatividades/);
 assert.match(toolbar,/setInoperabilityReportOpen\(true\)/);
 assert.match(source,/open=\{inoperabilityReportOpen\} onClose=/);
 const css=fs.readFileSync(new URL('../src/admin-report-actions.css',import.meta.url),'utf8');
 assert.match(css,/grid-template-columns:repeat\(2/);assert.match(css,/admin-report-inoperability\{background:#b91c1c;color:#fff/);
 const report=fs.readFileSync(new URL('../src/UnitOperabilityReport.jsx',import.meta.url),'utf8');
 assert.match(report,/if\(!canReadAdminReports\(access\)\)return null/);assert.match(report,/if\(controlled&&!open\)return null/);
});
