begin;

create table if not exists public.svb_checklist_submissions (
  id uuid primary key default gen_random_uuid(),
  lot text not null,
  zone text not null,
  unit text not null,
  vehicle_label text not null check (vehicle_label ~ '^[0-9]{4}$'),
  guard_code text not null,
  guard_started_at timestamptz not null,
  answers jsonb not null,
  submitted_by uuid not null references auth.users(id),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lot, unit, guard_code, vehicle_label)
);

create index if not exists svb_checklist_scope_date
  on public.svb_checklist_submissions(lot, zone, guard_started_at desc);

alter table public.svb_checklist_submissions enable row level security;
revoke all on public.svb_checklist_submissions from public, anon, authenticated;

-- New receipt history starts at installation; historical first sends are unknown.
create table if not exists public.svb_checklist_receipts (
 id bigint generated always as identity primary key,
 submission_id uuid not null references public.svb_checklist_submissions(id),
 lot text not null,zone text not null,unit text not null,guard_code text not null,
 vehicle_label text not null,received_at timestamptz not null default clock_timestamp()
);
alter table public.svb_checklist_receipts enable row level security;
revoke all on public.svb_checklist_receipts from public,anon,authenticated;
create index if not exists svb_checklist_receipts_guard on public.svb_checklist_receipts(unit,guard_code,received_at);

create or replace function public.submit_svb_checklist(
  p_guard_code text,
  p_vehicle_label text,
  p_guard_started_at timestamptz,
  p_answers jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_device public.device_authorizations%rowtype;v_row public.svb_checklist_submissions%rowtype;v_zone text;v_local_start timestamp;v_end timestamptz;v_received timestamptz;
begin
  select d.* into v_device from public.device_authorizations d
  join public.app_security_config c on c.singleton=true
  where d.user_id=auth.uid() and d.active and d.authorization_version=c.authorization_version;
  if not found then raise exception 'DEVICE_NOT_AUTHORIZED'; end if;
  select w.zone into v_zone from public.unit_warehouse_assignments a
  join public.warehouses w on w.id=a.warehouse_id
  where a.unit=v_device.unit and w.lot=v_device.lot;
  if v_zone is null then raise exception 'UNIT_WAREHOUSE_NOT_CONFIGURED'; end if;
  if coalesce(p_guard_code,'')='' or p_guard_started_at is null or p_vehicle_label !~ '^[0-9]{4}$'
     or jsonb_typeof(p_answers)<>'object'
     or jsonb_typeof(p_answers->'left')<>'object'
     or jsonb_typeof(p_answers->'front')<>'object'
     or jsonb_typeof(p_answers->'right')<>'object'
  then raise exception 'INVALID_SVB_CHECKLIST'; end if;
  v_local_start:=p_guard_started_at at time zone 'Europe/Madrid';
  if to_char(v_local_start,'DDMMYY')<>p_guard_code
    or extract(hour from v_local_start) not in (7,8,9)
    or extract(minute from v_local_start)<>0 or extract(second from v_local_start)<>0
  then raise exception 'INVALID_SVB_GUARD'; end if;
  v_end:=(case when extract(hour from v_local_start)=9 then date_trunc('day',v_local_start)+interval '21 hours'
    else v_local_start+interval '1 day' end) at time zone 'Europe/Madrid';
  v_received:=clock_timestamp();
  if v_received>=v_end-interval '1 hour' then raise exception 'CHECKLIST_GUARD_EXPIRED'; end if;
  if v_received<p_guard_started_at-interval '1 hour' then raise exception 'CHECKLIST_GUARD_TOO_EARLY'; end if;

  insert into public.svb_checklist_submissions(
    lot,zone,unit,vehicle_label,guard_code,guard_started_at,answers,submitted_by,submitted_at
  ) values(
    v_device.lot,v_zone,v_device.unit,p_vehicle_label,p_guard_code,
    p_guard_started_at,p_answers,auth.uid(),v_received
  ) on conflict(lot,unit,guard_code,vehicle_label) do update set
    answers=excluded.answers,submitted_by=auth.uid(),submitted_at=v_received,updated_at=v_received
  returning * into v_row;
  insert into public.svb_checklist_receipts(submission_id,lot,zone,unit,guard_code,vehicle_label,received_at)
    values(v_row.id,v_row.lot,v_row.zone,v_row.unit,v_row.guard_code,v_row.vehicle_label,v_received);
  update public.device_authorizations set last_seen_at=now() where user_id=auth.uid();
  return to_jsonb(v_row);
end $$;

revoke all on function public.submit_svb_checklist(text,text,timestamptz,jsonb) from public,anon;
grant execute on function public.submit_svb_checklist(text,text,timestamptz,jsonb) to authenticated;

commit;
