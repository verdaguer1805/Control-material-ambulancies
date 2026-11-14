-- BP / Polivalente: infrastructure only. Does not activate mobile UI or alter stock.
-- Run as database owner before deploying the BP operational frontend.
begin;

create table if not exists public.bp_checklist_submissions (
 id uuid primary key default gen_random_uuid(),
 lot text not null, zone text not null, unit text not null,
 vehicle_label text not null check(vehicle_label ~ '^[0-9]{4}$'),
 guard_code text not null, guard_started_at timestamptz not null,
 items jsonb not null, submitted_by uuid not null references auth.users(id),
 submitted_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 unique(lot,unit,guard_code,vehicle_label)
);
create index if not exists bp_checklist_scope_date on public.bp_checklist_submissions(lot,zone,guard_started_at);
alter table public.bp_checklist_submissions enable row level security;
revoke all on public.bp_checklist_submissions from public,anon,authenticated;
create table if not exists public.bp_checklist_receipts (
 id bigint generated always as identity primary key,
 submission_id uuid not null references public.bp_checklist_submissions(id),
 received_at timestamptz not null default clock_timestamp(),
 submitted_by uuid not null references auth.users(id)
);
alter table public.bp_checklist_receipts enable row level security;
revoke all on public.bp_checklist_receipts from public,anon,authenticated;

create or replace function public.submit_bp_checklist(
 p_guard_code text,p_vehicle_label text,p_guard_started_at timestamptz,p_items jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.device_authorizations%rowtype; r public.bp_checklist_submissions%rowtype;
 z text; local_start timestamp; guard_end timestamptz; received timestamptz:=clock_timestamp(); i jsonb;
begin
 select a.* into d from public.device_authorizations a
 join public.app_security_config c on c.singleton=true
 where a.user_id=auth.uid() and a.active and a.authorization_version=c.authorization_version;
 if not found then raise exception 'DEVICE_NOT_AUTHORIZED'; end if;
 if d.unit !~* '^BP[0-9]+$' then raise exception 'BP_UNIT_REQUIRED'; end if;
 select w.zone into z from public.unit_warehouse_assignments a join public.warehouses w on w.id=a.warehouse_id
 where a.unit=d.unit and w.lot=d.lot;
 if z is null then raise exception 'UNIT_WAREHOUSE_NOT_CONFIGURED'; end if;
 if coalesce(p_guard_code,'')='' or p_guard_started_at is null or coalesce(p_vehicle_label,'') !~ '^[0-9]{4}$'
 or p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'INVALID_BP_CHECKLIST'; end if;
 if jsonb_array_length(p_items)<>222 then raise exception 'INCOMPLETE_BP_CHECKLIST'; end if;
 if exists(select 1 from jsonb_array_elements(p_items)x where not (x->>'id'=any(array['bp-item-3','bp-item-4','bp-item-5','bp-item-6','bp-item-7','bp-item-8','bp-item-9','bp-item-10','bp-item-11','bp-item-12','bp-item-13','bp-item-14','bp-item-15','bp-item-16','bp-item-17','bp-item-18','bp-item-19','bp-item-20','bp-item-24','bp-item-25','bp-item-26','bp-item-30','bp-item-31','bp-item-35','bp-item-36','bp-item-37','bp-item-38','bp-item-39','bp-item-40','bp-item-41','bp-item-42','bp-item-43','bp-item-44','bp-item-45','bp-item-49','bp-item-53','bp-item-54','bp-item-55','bp-item-56','bp-item-57','bp-item-58','bp-item-59','bp-item-60','bp-item-61','bp-item-62','bp-item-63','bp-item-67','bp-item-72','bp-item-73','bp-item-74','bp-item-75','bp-item-79','bp-item-80','bp-item-81','bp-item-82','bp-item-83','bp-item-84','bp-item-85','bp-item-89','bp-item-90','bp-item-91','bp-item-92','bp-item-96','bp-item-97','bp-item-98','bp-item-99','bp-item-100','bp-item-104','bp-item-105','bp-item-106','bp-item-107','bp-item-108','bp-item-109','bp-item-110','bp-item-111','bp-item-115','bp-item-116','bp-item-117','bp-item-118','bp-item-119','bp-item-120','bp-item-121','bp-item-122','bp-item-123','bp-item-124','bp-item-128','bp-item-129','bp-item-130','bp-item-131','bp-item-132','bp-item-133','bp-item-134','bp-item-139','bp-item-140','bp-item-141','bp-item-142','bp-item-143','bp-item-144','bp-item-145','bp-item-149','bp-item-150','bp-item-151','bp-item-152','bp-item-153','bp-item-154','bp-item-155','bp-item-156','bp-item-157','bp-item-158','bp-item-159','bp-item-163','bp-item-164','bp-item-165','bp-item-169','bp-item-170','bp-item-171','bp-item-172','bp-item-173','bp-item-174','bp-item-175','bp-item-176','bp-item-177','bp-item-178','bp-item-179','bp-item-180','bp-item-181','bp-item-182','bp-item-183','bp-item-184','bp-item-188','bp-item-192','bp-item-193','bp-item-197','bp-item-198','bp-item-199','bp-item-200','bp-item-204','bp-item-205','bp-item-206','bp-item-207','bp-item-208','bp-item-212','bp-item-213','bp-item-214','bp-item-215','bp-item-216','bp-item-217','bp-item-218','bp-item-219','bp-item-220','bp-item-221','bp-item-222','bp-item-223','bp-item-227','bp-item-231','bp-item-232','bp-item-233','bp-item-237','bp-item-238','bp-item-239','bp-item-240','bp-item-241','bp-item-242','bp-item-243','bp-item-244','bp-item-248','bp-item-252','bp-item-256','bp-item-257','bp-item-258','bp-item-259','bp-item-260','bp-item-261','bp-item-262','bp-item-263','bp-item-264','bp-item-265','bp-item-266','bp-item-267','bp-item-268','bp-item-269','bp-item-270','bp-item-271','bp-item-272','bp-item-276','bp-item-280','bp-item-281','bp-item-282','bp-item-283','bp-item-284','bp-item-285','bp-item-289','bp-item-290','bp-item-291','bp-item-292','bp-item-293','bp-item-297','bp-item-298','bp-item-302','bp-item-303','bp-item-304','bp-item-305','bp-item-306','bp-item-307','bp-item-308','bp-item-309','bp-item-313','bp-item-314','bp-item-315','bp-item-316','bp-item-317','bp-item-318','bp-item-319','bp-item-320','bp-item-321','bp-item-322','bp-item-323','bp-item-324','bp-item-325','bp-item-326','bp-item-327','bp-item-328']::text[]))) then raise exception 'INVALID_BP_CATALOG'; end if;
 for i in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(i)<>'object' or coalesce(i->>'id','') !~ '^bp-item-[0-9]+$'
  or coalesce(i->>'label','')='' or coalesce(i->>'section','')=''
  or coalesce(i->>'status','') not in ('ok','issue') or length(coalesce(i->>'note',''))>1000
  then raise exception 'INCOMPLETE_BP_CHECKLIST'; end if;
 end loop;
 if (select count(distinct x->>'id') from jsonb_array_elements(p_items)x)<>jsonb_array_length(p_items)
 then raise exception 'INVALID_BP_CHECKLIST'; end if;
 local_start:=p_guard_started_at at time zone 'Europe/Madrid';
 if to_char(local_start,'DDMMYY')<>p_guard_code or extract(hour from local_start) not in (7,8,9)
 or extract(minute from local_start)<>0 or extract(second from local_start)<>0
 then raise exception 'INVALID_BP_GUARD'; end if;
 guard_end:=(case when extract(hour from local_start)=9 then date_trunc('day',local_start)+interval '21 hours'
 else local_start+interval '1 day' end) at time zone 'Europe/Madrid';
 if received>=guard_end-interval '1 hour' then raise exception 'CHECKLIST_GUARD_EXPIRED'; end if;
 if received<p_guard_started_at-interval '1 hour' then raise exception 'CHECKLIST_GUARD_TOO_EARLY'; end if;
 insert into public.bp_checklist_submissions(lot,zone,unit,vehicle_label,guard_code,guard_started_at,items,submitted_by,submitted_at,updated_at)
 values(d.lot,z,d.unit,p_vehicle_label,p_guard_code,p_guard_started_at,p_items,auth.uid(),received,received)
 on conflict(lot,unit,guard_code,vehicle_label) do update set items=excluded.items,
 submitted_by=excluded.submitted_by,submitted_at=excluded.submitted_at,updated_at=excluded.updated_at
 returning * into r;
 insert into public.bp_checklist_receipts(submission_id,received_at,submitted_by) values(r.id,received,auth.uid());
 return to_jsonb(r);
end $$;
revoke all on function public.submit_bp_checklist(text,text,timestamptz,jsonb) from public,anon;
grant execute on function public.submit_bp_checklist(text,text,timestamptz,jsonb) to authenticated;

create or replace function public.get_bp_checklists_report(p_lot text,p_zone text,p_from date,p_to date)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.admin_can_access_zone(p_zone) then raise exception 'ADMIN_ZONE_ACCESS_DENIED'; end if;
 if nullif(trim(p_lot),'') is null or nullif(trim(p_zone),'') is null or p_from is null or p_to is null
 or p_from>p_to or p_to-p_from>366 then raise exception 'INVALID_REPORT_SCOPE'; end if;
 return coalesce((select jsonb_agg(to_jsonb(r) order by r.guard_started_at desc,r.unit)
 from public.bp_checklist_submissions r where r.lot=p_lot and r.zone=p_zone
 and r.guard_started_at>=(p_from::timestamp at time zone 'Europe/Madrid')
 and r.guard_started_at<((p_to+1)::timestamp at time zone 'Europe/Madrid')),'[]'::jsonb);
end $$;
revoke all on function public.get_bp_checklists_report(text,text,date,date) from public,anon;
grant execute on function public.get_bp_checklists_report(text,text,date,date) to authenticated;

-- Extend the deployed functions in place, retaining their current authorization,
-- concurrency, offline and identity protections. Abort on an unexpected definition.
do $$
declare signature text; definition text; changed text; c record;
begin
 foreach signature in array array[
 'public.submit_vehicle_audit(uuid,text,text,jsonb)',
 'public.begin_mobile_auditor_audit(uuid,integer,text,text,jsonb)'
 ] loop
  definition:=pg_get_functiondef(to_regprocedure(signature));
  if definition is null then raise exception 'MISSING_REQUIRED_FUNCTION: %',signature; end if;
  changed:=replace(definition,'''TSNU'',''SVB''','''TSNU'',''SVB'',''Polivalente''');
  if changed=definition and position('''Polivalente''' in definition)=0 then
   raise exception 'UNEXPECTED_FUNCTION_DEFINITION: %',signature;
  end if;
  if changed<>definition then execute changed; end if;
 end loop;
 for c in select conname,pg_get_constraintdef(oid) as definition from pg_constraint
 where conrelid='public.supervisor_vehicle_audits'::regclass and contype='c'
 and pg_get_constraintdef(oid) like '%checklist_type%'
 loop
  execute format('alter table public.supervisor_vehicle_audits drop constraint %I',c.conname);
 end loop;
 alter table public.supervisor_vehicle_audits add constraint supervisor_vehicle_audits_checklist_type_check
 check(checklist_type in ('TSNU','SVB','Polivalente'));
end $$;
commit;

select to_regprocedure('public.submit_bp_checklist(text,text,timestamptz,jsonb)') is not null as bp_units_ready,
 to_regprocedure('public.get_bp_checklists_report(text,text,date,date)') is not null as bp_reports_ready;
