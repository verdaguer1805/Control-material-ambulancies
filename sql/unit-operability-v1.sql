-- Additive migration. Install only after review and explicit user Run.
-- No stock, checklist, assignment or guard changes. Plates rendered only in report.
begin;
create table if not exists public.fleet_vehicle_registry (
 lot text not null, vehicle text not null, plate text not null, reference_zone text not null,
 reference_unit text not null default '', vehicle_type text not null default '',
 base text not null default '', locality text not null default '',
 primary key(lot,vehicle),unique(lot,plate)
);
create table if not exists public.unit_operability_incidents (
 id uuid primary key,lot text not null,zone text not null,unit text not null,
 vehicle text not null,plate text not null,reason text not null,
 has_patient boolean not null,description text not null default '',justification text not null default '',
 started_at timestamptz not null,received_at timestamptz not null default clock_timestamp(),
 started_by uuid not null references auth.users(id),
 ended_at timestamptz,closed_received_at timestamptz,closed_by uuid references auth.users(id),close_operation_id uuid unique,
 resolution text not null default '',check(ended_at is null or ended_at>=started_at),
 check(reason in ('material','accident','cleaning','staff','maintenance'))
);
create unique index if not exists one_unit_inoperability_open on public.unit_operability_incidents(lot,unit) where ended_at is null;
create index if not exists operability_scope_date on public.unit_operability_incidents(lot,zone,started_at desc,unit);
alter table public.fleet_vehicle_registry enable row level security;
alter table public.unit_operability_incidents enable row level security;
revoke all on public.fleet_vehicle_registry,public.unit_operability_incidents from public,anon,authenticated;

create or replace function app_private.require_operability_unit(p_lot text,p_unit text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.device_authorizations%rowtype; z text;
begin
 select a.* into d from public.device_authorizations a join public.app_security_config c on c.singleton=true
 where a.user_id=auth.uid() and a.active and a.authorization_version=c.authorization_version;
 if not found or d.unit ~* '^(Material supervisor|SUPERVISOR_|Auditor)' then raise exception 'DEVICE_NOT_AUTHORIZED';end if;
 if d.lot is distinct from p_lot or d.unit is distinct from p_unit then raise exception 'OPERABILITY_SCOPE_CHANGED';end if;
 if d.unit ~* '^(T|K|KE)[0-9]' or exists(select 1 from public.tsnu_units u where u.lot=d.lot and u.unit=d.unit)
 then raise exception 'OPERABILITY_TSU_ONLY';end if;
 select w.zone into z from public.unit_warehouse_assignments a join public.warehouses w on w.id=a.warehouse_id
 where a.unit=d.unit and w.lot=d.lot;
 if z is null then raise exception 'UNIT_WAREHOUSE_NOT_CONFIGURED';end if;
 return jsonb_build_object('lot',d.lot,'unit',d.unit,'zone',z);
end $$;
revoke all on function app_private.require_operability_unit(text,text) from public,anon,authenticated;

create or replace function public.get_my_unit_operability(p_expected_lot text,p_expected_unit text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ctx jsonb;active_record jsonb;vehicles jsonb;
begin
 ctx:=app_private.require_operability_unit(p_expected_lot,p_expected_unit);
 -- Deliberately exclude plate from every mobile response.
 select to_jsonb(i)-'plate' into active_record from public.unit_operability_incidents i
 where i.lot=p_expected_lot and i.unit=p_expected_unit and i.ended_at is null;
 select coalesce(jsonb_agg(jsonb_build_object('vehicle',r.vehicle,'reference_unit',r.reference_unit,'reference_zone',r.reference_zone) order by r.vehicle),'[]'::jsonb)
 into vehicles from public.fleet_vehicle_registry r where r.lot=p_expected_lot;
 return ctx||jsonb_build_object('verified',true,'active',active_record,'vehicles',vehicles);
end $$;

create or replace function public.start_my_unit_inoperability(
 p_expected_lot text,p_expected_unit text,p_id uuid,p_vehicle text,p_reason text,p_has_patient boolean,
 p_description text,p_justification text,p_started_at timestamptz
) returns jsonb language plpgsql security definer set search_path='' as $$
declare ctx jsonb; existing public.unit_operability_incidents%rowtype;v_plate text;
begin
 ctx:=app_private.require_operability_unit(p_expected_lot,p_expected_unit);
 perform pg_advisory_xact_lock(hashtextextended(p_expected_lot||':'||p_expected_unit,0));
 if p_id is null or p_has_patient is null or p_reason is null or p_reason not in ('material','accident','cleaning','staff','maintenance')
 or length(coalesce(p_description,''))>4000 or length(coalesce(p_justification,''))>4000 then raise exception 'INVALID_INOPERABILITY';end if;
 select * into existing from public.unit_operability_incidents where id=p_id;
 if found then
  if existing.lot<>p_expected_lot or existing.unit<>p_expected_unit or existing.vehicle is distinct from p_vehicle or existing.reason is distinct from p_reason
  or existing.has_patient is distinct from p_has_patient or existing.description is distinct from coalesce(p_description,'')
  or existing.justification is distinct from coalesce(p_justification,'') or existing.started_at is distinct from p_started_at
  then raise exception 'OPERABILITY_OPERATION_CONFLICT';end if;
  return public.get_my_unit_operability(p_expected_lot,p_expected_unit);
 end if;
 if p_started_at is null or p_started_at>clock_timestamp()+interval '5 minutes' then raise exception 'OPERABILITY_INVALID_TIME';end if;
 if exists(select 1 from public.unit_operability_incidents where lot=p_expected_lot and unit=p_expected_unit and ended_at is null)
 then raise exception 'UNIT_ALREADY_INOPERATIVE';end if;
 select plate into v_plate from public.fleet_vehicle_registry where lot=p_expected_lot and vehicle=p_vehicle;
 if not found then raise exception 'VEHICLE_NOT_REGISTERED';end if;
 insert into public.unit_operability_incidents(id,lot,zone,unit,vehicle,plate,reason,has_patient,description,justification,started_at,started_by)
 values(p_id,p_expected_lot,ctx->>'zone',p_expected_unit,p_vehicle,v_plate,p_reason,p_has_patient,coalesce(p_description,''),coalesce(p_justification,''),p_started_at,auth.uid());
 return public.get_my_unit_operability(p_expected_lot,p_expected_unit);
end $$;

-- Hidden mobile cache for the selected vehicle. No UI displays the plate.
-- Submission still snapshots the server registry, never trusts a client plate.
create or replace function public.get_my_operability_vehicle(p_expected_lot text,p_expected_unit text,p_vehicle text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ctx jsonb;row public.fleet_vehicle_registry%rowtype;
begin
 ctx:=app_private.require_operability_unit(p_expected_lot,p_expected_unit);
 select * into row from public.fleet_vehicle_registry where lot=p_expected_lot and vehicle=p_vehicle;
 if not found then raise exception 'VEHICLE_NOT_REGISTERED';end if;
 return jsonb_build_object('verified',true,'lot',row.lot,'vehicle',row.vehicle,'plate',row.plate);
end $$;

create or replace function public.close_my_unit_inoperability(
 p_expected_lot text,p_expected_unit text,p_id uuid,p_operation_id uuid,p_resolution text,p_ended_at timestamptz
) returns jsonb language plpgsql security definer set search_path='' as $$
declare ctx jsonb;existing public.unit_operability_incidents%rowtype;
begin
 ctx:=app_private.require_operability_unit(p_expected_lot,p_expected_unit);
 perform pg_advisory_xact_lock(hashtextextended(p_expected_lot||':'||p_expected_unit,0));
 select * into existing from public.unit_operability_incidents where id=p_id and lot=p_expected_lot and unit=p_expected_unit for update;
 if not found then raise exception 'OPERABILITY_NOT_FOUND';end if;
 if existing.ended_at is not null then
  if existing.close_operation_id is distinct from p_operation_id or existing.resolution is distinct from coalesce(p_resolution,'') or existing.ended_at is distinct from p_ended_at
  then raise exception 'OPERABILITY_OPERATION_CONFLICT';end if;
  return public.get_my_unit_operability(p_expected_lot,p_expected_unit);
 end if;
 if p_operation_id is null or length(coalesce(p_resolution,''))>4000 then raise exception 'INVALID_INOPERABILITY';end if;
 if p_ended_at is null or p_ended_at<existing.started_at or p_ended_at>clock_timestamp()+interval '5 minutes' then raise exception 'OPERABILITY_INVALID_TIME';end if;
 update public.unit_operability_incidents set ended_at=p_ended_at,closed_received_at=clock_timestamp(),closed_by=auth.uid(),close_operation_id=p_operation_id,resolution=coalesce(p_resolution,'') where id=p_id;
 return public.get_my_unit_operability(p_expected_lot,p_expected_unit);
end $$;

-- All fields, including plate, accessible only through an authenticated admin session.
create or replace function public.get_unit_inoperability_report(p_lot text,p_zone text,p_from timestamptz,p_to timestamptz,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.admin_has_role(array['owner','supervisor','logistics']) then raise exception 'ADMIN_REQUIRED';end if;
 if coalesce(p_lot,'')='' or coalesce(p_zone,'')='' or not public.admin_can_access_zone(p_zone) then raise exception 'SCOPE_REQUIRED';end if;
 if p_from is null or p_to is null or p_to<=p_from or p_offset<0 then raise exception 'INVALID_REPORT_RANGE';end if;
 return coalesce((select jsonb_agg(to_jsonb(r)) from (select * from public.unit_operability_incidents
 where lot=p_lot and zone=p_zone and started_at>=p_from and started_at<p_to order by started_at desc,unit,id limit 1000 offset p_offset)r),'[]'::jsonb);
end $$;

revoke all on function public.get_my_operability_vehicle(text,text,text),public.get_my_unit_operability(text,text),public.start_my_unit_inoperability(text,text,uuid,text,text,boolean,text,text,timestamptz),public.close_my_unit_inoperability(text,text,uuid,uuid,text,timestamptz),public.get_unit_inoperability_report(text,text,timestamptz,timestamptz,integer) from public,anon;
grant execute on function public.get_my_operability_vehicle(text,text,text),public.get_my_unit_operability(text,text),public.start_my_unit_inoperability(text,text,uuid,text,text,boolean,text,text,timestamptz),public.close_my_unit_inoperability(text,text,uuid,uuid,text,timestamptz),public.get_unit_inoperability_report(text,text,timestamptz,timestamptz,integer) to authenticated;
commit;
