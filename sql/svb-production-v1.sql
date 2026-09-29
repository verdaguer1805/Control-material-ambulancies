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

create or replace function public.submit_svb_checklist(
  p_guard_code text,
  p_vehicle_label text,
  p_guard_started_at timestamptz,
  p_answers jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_device public.device_authorizations%rowtype;v_row public.svb_checklist_submissions%rowtype;v_zone text;
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
  insert into public.svb_checklist_submissions(
    lot,zone,unit,vehicle_label,guard_code,guard_started_at,answers,submitted_by
  ) values(
    v_device.lot,v_zone,v_device.unit,p_vehicle_label,p_guard_code,
    p_guard_started_at,p_answers,auth.uid()
  ) on conflict(lot,unit,guard_code,vehicle_label) do update set
    answers=excluded.answers,submitted_by=auth.uid(),submitted_at=now(),updated_at=now()
  returning * into v_row;
  update public.device_authorizations set last_seen_at=now() where user_id=auth.uid();
  return to_jsonb(v_row);
end $$;

revoke all on function public.submit_svb_checklist(text,text,timestamptz,jsonb) from public,anon;
grant execute on function public.submit_svb_checklist(text,text,timestamptz,jsonb) to authenticated;

commit;
