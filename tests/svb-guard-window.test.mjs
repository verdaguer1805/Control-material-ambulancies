import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {svbGuardPeriod,svbGuardOptions,svbAssignedGuard,svbGuardStatus,svbGuardLabel} from '../src/svb-guard-window.mjs';
const now=local=>new Date(`${local}+02:00`);
test('next guard is assigned automatically exactly one hour before start',()=>{
 assert.equal(svbGuardOptions('07:00',now('2026-10-08T05:59:59')).next,null);
 assert.equal(svbAssignedGuard('07:00',now('2026-10-08T05:59:59')).code,'071026');
 const options=svbGuardOptions('07:00',now('2026-10-08T06:00:00'));
 assert.equal(options.current,null);assert.equal(options.next.code,'081026');
 assert.equal(svbAssignedGuard('07:00',now('2026-10-08T06:00:00')).code,'081026');
 assert.equal(svbGuardOptions('07:00',now('2026-10-08T07:00:00')).next,null);
 assert.equal(svbGuardOptions('07:00',now('2026-10-08T07:00:00')).current.code,'081026');
});
test('06:50 preparation remains the same guard and same scope at 07:15',()=>{
 const period=svbGuardOptions('07:00',now('2026-10-08T06:50:00')).next;
 const context={guardCode:period.code,guardStartedAt:period.start};
 assert.equal(svbGuardStatus(context,now('2026-10-08T06:50:00')),'upcoming');
 assert.equal(svbGuardStatus(context,now('2026-10-08T07:15:00')),'current');
 assert.equal(context.guardCode,'081026');
 assert.match(svbGuardLabel(context,now('2026-10-08T06:50:00')),/No se modificará/);
});
test('old guard locks one hour before shift end, including G452 late-send case',()=>{
 const context={guardCode:'071026',guardStartedAt:'2026-10-07T05:00:00Z'};
 assert.equal(svbGuardStatus(context,now('2026-10-08T05:59:59')),'current');
 assert.equal(svbGuardStatus(context,now('2026-10-08T06:00:00')),'expired');
 assert.equal(svbGuardStatus(context,now('2026-10-08T06:59:59')),'expired');
 assert.equal(svbGuardStatus(context,now('2026-10-08T07:00:00')),'expired');
 assert.equal(svbGuardStatus(context,now('2026-10-08T07:00:59')),'expired');
});
test('all configured schedules, mismatching codes and invalid starts are covered',()=>{
 for(const shift of ['07:00','08:00','09:00']){
  const hour=shift.slice(0,2),prior=String(+hour-1).padStart(2,'0');
  assert.equal(svbGuardOptions(shift,now(`2026-10-08T${prior}:45:00`)).next.code,'081026');
  assert.equal(svbGuardOptions(shift,now(`2026-10-08T${hour}:01:00`)).next,null);
 }
 assert.equal(svbGuardOptions('09:00',now('2026-10-08T21:00:00')).current,null);
 assert.equal(svbAssignedGuard('09:00',now('2026-10-08T20:00:00')),null);
 assert.equal(svbGuardPeriod('2026-10-08T05:01:00Z'),null);
 assert.equal(svbGuardStatus({guardCode:'071026',guardStartedAt:'2026-10-08T05:00:00Z'}),'invalid');
});
test('Madrid civil guard end follows daylight saving, not a fixed 24-hour UTC duration',()=>{
 const autumn=svbGuardPeriod('2026-10-24T05:00:00Z');
 assert.equal(autumn.end,'2026-10-25T06:00:00.000Z');
 const spring=svbGuardPeriod('2026-03-28T06:00:00Z');
 assert.equal(spring.end,'2026-03-29T05:00:00.000Z');
});
test('browser and app validators are identical and backend rejects expired legacy requests',()=>{
 const read=path=>readFileSync(new URL(path,import.meta.url),'utf8').replace(/\r\n/g,'\n').trim();
 assert.equal(read('../src/svb-guard-window.mjs'),read('../public/checklists/svb-guard-window.js'));
 const sql=read('../sql/svb-guard-window-v1.sql');
 assert.match(sql,/v_received>=v_end-interval '1 hour'/);assert.match(sql,/p_guard_started_at-interval '1 hour'/);
 assert.ok(sql.indexOf('CHECKLIST_GUARD_EXPIRED')<sql.indexOf('insert into public.svb_checklist_submissions'));
 assert.match(sql,/clock_timestamp\(\)/);assert.match(sql,/svb_checklist_receipts/);
 assert.match(sql,/v_received/);
 const menu=read('../public/checklists/svb-zones-production.js');
 assert.match(menu,/svbGuardStatus\(context\)/);assert.match(menu,/CHECKLIST_GUARD_EXPIRED/);
 const app=read('../src/main.jsx');
 assert.match(app,/const selected = svbAssignedGuard/);
 assert.doesNotMatch(app,/Preparar checklist próxima guardia/);
});
