-- Independent supervisor audits: no guard, consumption or inventory writes.
begin;
create table if not exists public.supervisor_vehicle_audits (
 id uuid primary key,
 lot text not null,
 zone text not null,
 supervisor text not null,
 auditor_id uuid not null references auth.users(id),
 vehicle text not null,
 checklist_type text not null check (checklist_type in ('TSNU','SVB')),
 items jsonb not null,
 received_at timestamptz not null default clock_timestamp()
);
create index if not exists supervisor_vehicle_audits_scope on public.supervisor_vehicle_audits(lot,zone,received_at desc);
alter table public.supervisor_vehicle_audits enable row level security;
revoke all on public.supervisor_vehicle_audits from public,anon,authenticated;

create or replace function public.submit_vehicle_audit(p_id uuid,p_vehicle text,p_type text,p_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_device public.device_authorizations%rowtype; v_zone text; v_item jsonb; v_row public.supervisor_vehicle_audits%rowtype;
begin
 select d.* into v_device from public.device_authorizations d
 join public.app_security_config c on c.singleton=true
 where d.user_id=auth.uid() and d.active and d.authorization_version=c.authorization_version;
 if not found or v_device.unit !~* '^Material supervisor\s*·\s*\S' then
  raise exception 'SUPERVISOR_NOT_AUTHORIZED';
 end if;
 v_zone:=trim(regexp_replace(v_device.unit,'^Material supervisor\s*·\s*','','i'));
 if not exists(select 1 from public.warehouses w where w.lot=v_device.lot and w.zone=v_zone) then
  raise exception 'SUPERVISOR_ZONE_NOT_CONFIGURED';
 end if;
 if p_id is null or p_vehicle is null or upper(trim(p_vehicle)) !~ '^[A-Z0-9][A-Z0-9-]{2,19}$'
  or p_type is null or p_type not in ('TSNU','SVB') or p_items is null or jsonb_typeof(p_items)<>'array' then
  raise exception 'INVALID_VEHICLE_AUDIT';
 end if;
 if jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>1000 then raise exception 'INVALID_VEHICLE_AUDIT'; end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(v_item)<>'object' or coalesce(v_item->>'id','')='' or coalesce(v_item->>'label','')=''
   or coalesce(v_item->>'section','')='' or coalesce(v_item->>'status','') not in ('ok','issue')
   or length(coalesce(v_item->>'note',''))>1000 then raise exception 'INCOMPLETE_VEHICLE_AUDIT'; end if;
 end loop;
 if (select count(distinct x->>'id') from jsonb_array_elements(p_items) x)<>jsonb_array_length(p_items) then
  raise exception 'INVALID_VEHICLE_AUDIT';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into v_row from public.supervisor_vehicle_audits where id=p_id;
 if found then
  if v_row.auditor_id<>auth.uid() or v_row.lot<>v_device.lot or v_row.zone<>v_zone
   or v_row.vehicle<>upper(trim(p_vehicle)) or v_row.checklist_type<>p_type or v_row.items<>p_items then
   raise exception 'AUDIT_ALREADY_CONFIRMED';
  end if;
  return to_jsonb(v_row);
 end if;
 insert into public.supervisor_vehicle_audits(id,lot,zone,supervisor,auditor_id,vehicle,checklist_type,items)
 values(p_id,v_device.lot,v_zone,v_device.unit,auth.uid(),upper(trim(p_vehicle)),p_type,p_items) returning * into v_row;
 return to_jsonb(v_row);
end $$;
revoke all on function public.submit_vehicle_audit(uuid,text,text,jsonb) from public,anon;
grant execute on function public.submit_vehicle_audit(uuid,text,text,jsonb) to authenticated;

create or replace function public.get_vehicle_audits_report(p_lot text,p_zone text,p_from date,p_to date)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.admin_can_access_zone(p_zone) then raise exception 'ADMIN_ZONE_ACCESS_DENIED'; end if;
 if p_lot is null or p_zone is null or p_from is null or p_to is null or p_from>p_to then raise exception 'INVALID_REPORT_RANGE'; end if;
 return coalesce((select jsonb_agg(to_jsonb(a) order by a.received_at desc,a.vehicle)
  from public.supervisor_vehicle_audits a where a.lot=p_lot and a.zone=p_zone
  and a.received_at>=(p_from::timestamp at time zone 'Europe/Madrid')
  and a.received_at<((p_to+1)::timestamp at time zone 'Europe/Madrid')),'[]'::jsonb);
end $$;
revoke all on function public.get_vehicle_audits_report(text,text,date,date) from public,anon;
grant execute on function public.get_vehicle_audits_report(text,text,date,date) to authenticated;
commit;
