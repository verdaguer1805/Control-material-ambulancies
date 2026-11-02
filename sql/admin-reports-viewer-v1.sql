-- Read-only admin profile. No credentials in this file or public client.
-- Apply after unit-operability-v1.sql. Does not grant warehouse/stock access.
begin;
alter table app_private.admin_access_codes drop constraint if exists admin_access_codes_role_check;
alter table app_private.admin_access_codes add constraint admin_access_codes_role_check check(role in ('owner','logistics','supervisor','reports_viewer'));
alter table public.admin_access_sessions drop constraint if exists admin_access_sessions_role_check;
alter table public.admin_access_sessions add constraint admin_access_sessions_role_check check(role in ('owner','logistics','supervisor','reports_viewer'));

-- Existing authentication and attempt limiting remain unchanged. The existing
-- code lookup handles this additional hashed code through the same login RPC.
create or replace function public.current_admin_access()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_build_object('authorized',true,'role',role,'zone',zone,'expires_at',expires_at,
  'display_name',case when role='reports_viewer' then 'SOTS-CAP PICORNELL' else null end)
 from public.admin_access_sessions where user_id=auth.uid() and expires_at>now()),jsonb_build_object('authorized',false));
$$;

create or replace function public.admin_can_read_reports_zone(p_zone text)
returns boolean language sql stable security definer set search_path='' as $$
 select nullif(trim(p_zone),'') is not null and
 (public.admin_can_access_zone(p_zone) or public.admin_has_role(array['reports_viewer']));
$$;
revoke all on function public.admin_can_read_reports_zone(text) from public,anon,authenticated;

-- Change ONLY the five explicitly read-only export RPCs. Never broaden the
-- shared admin_can_access_zone/admin_has_role helpers used for stock/writes.
do $reports$
declare n text;oid regprocedure;definition text;
begin
 foreach n in array array['get_admin_report_data','get_tsnu_report_data','get_vehicle_audits_report','get_auditor_consumption_report','get_unit_inoperability_report'] loop
  oid:=to_regprocedure(case when n='get_unit_inoperability_report' then 'public.'||n||'(text,text,timestamp with time zone,timestamp with time zone,integer)' else 'public.'||n||'(text,text,date,date)' end);
  if oid is null then raise exception 'REPORT_RPC_MISSING: %',n;end if;
  definition:=pg_get_functiondef(oid);
  if position('public.admin_can_access_zone(' in definition)=0 and position('public.admin_can_read_reports_zone(' in definition)=0 then raise exception 'REPORT_AUTHORIZATION_REVIEW_REQUIRED: %',n;end if;
  definition:=replace(definition,'public.admin_can_access_zone(','public.admin_can_read_reports_zone(');
  if n='get_unit_inoperability_report' then
   definition:=replace(definition,'array[''owner'',''supervisor'',''logistics'']','array[''owner'',''supervisor'',''logistics'',''reports_viewer'']');
   definition:=replace(definition,'ARRAY[''owner''::text, ''supervisor''::text, ''logistics''::text]','ARRAY[''owner''::text, ''supervisor''::text, ''logistics''::text, ''reports_viewer''::text]');
   if position('''reports_viewer''' in definition)=0 then raise exception 'REPORT_ROLE_REVIEW_REQUIRED: %',n;end if;
  end if;
  execute definition;
 end loop;
end $reports$;

-- Future rotation from an authenticated owner only; other existing codes and
-- sessions remain intact. UI does not expose this management to the viewer.
create or replace function public.configure_reports_viewer_code(p_code text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.admin_has_role(array['owner']) then raise exception 'OWNER_AUTHORIZATION_REQUIRED';end if;
 if p_code is null or p_code !~ '^[A-Za-z0-9]{6,13}$' then raise exception 'INVALID_ACCESS_CODE';end if;
 if exists(select 1 from app_private.admin_access_codes where access_key<>'picornell' and extensions.crypt(p_code,code_hash)=code_hash)then raise exception 'DUPLICATED_ACCESS_CODE';end if;
 insert into app_private.admin_access_codes(access_key,role,zone,code_hash,updated_at)
 values('picornell','reports_viewer',null,extensions.crypt(p_code,extensions.gen_salt('bf')),now())
 on conflict(access_key) do update set role=excluded.role,zone=null,code_hash=excluded.code_hash,updated_at=now();
 delete from public.admin_access_sessions where role='reports_viewer';
 return true;
end $$;
revoke all on function public.configure_reports_viewer_code(text) from public,anon;
grant execute on function public.configure_reports_viewer_code(text) to authenticated;
commit;
