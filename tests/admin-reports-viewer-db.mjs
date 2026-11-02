// Isolated role/security regression test. No real credentials or production.
import {PGlite} from '../tmp/warehouse-db-test/node_modules/@electric-sql/pglite/dist/index.js';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite(),owner='00000000-0000-4000-8000-000000000001',viewer='00000000-0000-4000-8000-000000000002',sup='00000000-0000-4000-8000-000000000003';
try{
 await db.exec(`create schema auth;create schema app_private;create schema extensions;create role anon;create role authenticated;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function extensions.crypt(text,text) returns text language sql strict as $$select case when $2='salt' or $1=$2 then $1 else 'not-the-code' end$$;
 create function extensions.gen_salt(text) returns text language sql as $$select 'salt'::text$$;
 create table app_private.admin_access_codes(access_key text primary key,role text check(role in ('owner','logistics','supervisor')),zone text,code_hash text,updated_at timestamptz);
 create table public.admin_access_sessions(user_id uuid primary key,role text check(role in ('owner','logistics','supervisor')),zone text,expires_at timestamptz,created_at timestamptz);
 insert into public.admin_access_sessions values('${owner}','owner',null,now()+interval '1 hour',now()),('${sup}','supervisor','Olot',now()+interval '1 hour',now());
 insert into app_private.admin_access_codes values('owner','owner',null,'test-owner',now());
 create function public.admin_has_role(text[]) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.admin_access_sessions where user_id=auth.uid() and expires_at>now() and role=any($1))$$;
 create function public.admin_can_access_zone(text) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.admin_access_sessions where user_id=auth.uid() and expires_at>now() and (role in ('owner','logistics') or role='supervisor' and zone=$1))$$;
 create function public.current_admin_access() returns jsonb language sql stable security definer set search_path='' as $$select '{}'::jsonb$$;
 create function public.open_admin_access_session(input_code text) returns jsonb language plpgsql security definer set search_path='' as $$declare c app_private.admin_access_codes%rowtype;begin
 select * into c from app_private.admin_access_codes where extensions.crypt(input_code,code_hash)=code_hash;
 if not found then return jsonb_build_object('authorized',false);end if;
 insert into public.admin_access_sessions values(auth.uid(),c.role,c.zone,now()+interval '12 hours',now()) on conflict(user_id)do update set role=excluded.role,zone=excluded.zone,expires_at=excluded.expires_at;
 return public.current_admin_access();end$$;
 create table warehouse_inventory(zone text,quantity integer);insert into warehouse_inventory values('Olot',39);
 alter table warehouse_inventory enable row level security;
 grant select on warehouse_inventory to authenticated;
 create policy stock_read on warehouse_inventory for select to authenticated using(public.admin_can_access_zone(zone));
 create function public.fake_stock_write(p_zone text) returns boolean language plpgsql security definer set search_path='' as $$begin if not public.admin_can_access_zone(p_zone)then raise exception 'STOCK_DENIED';end if;update public.warehouse_inventory set quantity=0 where zone=p_zone;return true;end$$;
 create function public.fake_manage_devices()returns boolean language plpgsql security definer set search_path='' as $$begin if not public.admin_has_role(array['owner','logistics'])then raise exception 'MANAGEMENT_DENIED';end if;return true;end$$;`);
 for(const name of ['get_admin_report_data','get_tsnu_report_data','get_vehicle_audits_report','get_auditor_consumption_report'])await db.exec(`create function public.${name}(p_lot text,p_zone text,p_from date,p_to date)returns jsonb language plpgsql security definer set search_path='' as $$begin if not public.admin_can_access_zone(p_zone)then raise exception 'REPORT_DENIED';end if;return jsonb_build_object('lot',p_lot,'zone',p_zone,'read_only',true);end$$;`);
 await db.exec(`create function public.get_unit_inoperability_report(p_lot text,p_zone text,p_from timestamptz,p_to timestamptz,p_offset integer default 0)returns jsonb language plpgsql security definer set search_path='' as $$begin
 if not public.admin_has_role(array['owner','supervisor','logistics'])then raise exception 'ADMIN_REQUIRED';end if;
 if not public.admin_can_access_zone(p_zone)then raise exception 'REPORT_DENIED';end if;
 return jsonb_build_object('lot',p_lot,'zone',p_zone,'plate','0879NLG');end$$;`);
 const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
 const actor=uid=>db.query("select set_config('test.uid',$1,false)",[uid]);
 const stockBefore=await scalar("select pg_get_functiondef('public.admin_can_access_zone(text)'::regprocedure)");
 const loginBefore=await scalar("select pg_get_functiondef('public.open_admin_access_session(text)'::regprocedure)");
 const migration=fs.readFileSync(new URL('../sql/admin-reports-viewer-v1.sql',import.meta.url),'utf8');
 await db.exec(migration);await db.exec(migration);
 assert.equal(await scalar("select pg_get_functiondef('public.admin_can_access_zone(text)'::regprocedure)"),stockBefore);
 assert.equal(await scalar("select pg_get_functiondef('public.open_admin_access_session(text)'::regprocedure)"),loginBefore);
 await actor(owner);assert.equal(await scalar('select configure_reports_viewer_code($1)',['DemoReports1']),true);
 await actor(viewer);assert.equal((await scalar('select open_admin_access_session($1)',['wrong'])).authorized,false);
 const session=await scalar('select open_admin_access_session($1)',['DemoReports1']);assert.equal(session.authorized,true);assert.equal(session.role,'reports_viewer');assert.equal(session.display_name,'SOTS-CAP PICORNELL');
 for(const lot of ['Lot A','Lot B'])for(const zone of ['Olot','Girona','Blanes','Figueres']){
  assert.equal(await scalar('select admin_can_access_zone($1)',[zone]),false);
  for(const name of ['get_admin_report_data','get_tsnu_report_data','get_vehicle_audits_report','get_auditor_consumption_report'])assert.equal((await scalar(`select ${name}($1,$2,$3,$4)`,[lot,zone,'2026-11-01','2026-11-02'])).read_only,true);
  assert.equal((await scalar('select get_unit_inoperability_report($1,$2,$3,$4)',[lot,zone,'2026-11-01','2026-11-02'])).plate,'0879NLG');
  await assert.rejects(scalar('select fake_stock_write($1)',[zone]),/STOCK_DENIED/);
 }
 await assert.rejects(scalar('select fake_manage_devices()'),/MANAGEMENT_DENIED/);
 await assert.rejects(scalar('select configure_reports_viewer_code($1)',['test-other']),/OWNER_AUTHORIZATION_REQUIRED/);
 await db.exec('set role authenticated');assert.deepEqual((await db.query('select * from warehouse_inventory')).rows,[]);await db.exec('reset role');
 assert.equal(await scalar('select quantity from warehouse_inventory'),39);
 await db.query('update admin_access_sessions set expires_at=now()-interval \'1 hour\' where user_id=$1',[viewer]);
 await assert.rejects(scalar('select get_admin_report_data($1,$2,$3,$4)',['Lot A','Olot','2026-11-01','2026-11-02']),/REPORT_DENIED/);
 await actor(sup);assert.equal(await scalar('select admin_can_access_zone($1)',['Olot']),true);assert.equal(await scalar('select admin_can_access_zone($1)',['Blanes']),false);
 await actor(owner);assert.equal(await scalar('select admin_can_access_zone($1)',['Blanes']),true);assert.equal(await scalar('select count(*)::int from admin_access_sessions where user_id=$1',[owner]),1);
 console.log('Reports-only admin DB: PASS · same login, all report RPCs, no stock/devices/code management, RLS, expiry, existing owner/supervisor scopes unchanged.');
}catch(error){console.error(error.message,error.where||'');process.exitCode=1;}finally{await db.close();}
