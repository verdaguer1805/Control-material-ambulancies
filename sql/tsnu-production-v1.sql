-- TSNU production v1. Additive migration: it does not modify TSU consumption.
begin;

create table if not exists public.tsnu_units (
  lot text not null,
  zone text not null,
  unit text not null,
  active boolean not null default true,
  primary key (lot, zone, unit)
);

create table if not exists public.tsnu_unit_assignments (
  lot text not null,
  zone text not null,
  unit text not null,
  warehouse_id text not null references public.warehouses(id),
  checklist_version text not null default 'TSNU-v1',
  updated_at timestamptz not null default now(),
  primary key (lot, unit),
  foreign key (lot, zone, unit) references public.tsnu_units(lot, zone, unit)
);

create table if not exists public.tsnu_shift_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  lot text not null,
  zone text not null,
  unit text not null,
  warehouse_id text not null references public.warehouses(id),
  checklist_version text not null,
  started_at timestamptz not null,
  checklist_answers jsonb,
  checklist_submitted_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

create unique index if not exists tsnu_one_open_shift_per_device
  on public.tsnu_shift_sessions(user_id) where ended_at is null;
create index if not exists tsnu_shifts_scope_date
  on public.tsnu_shift_sessions(lot, zone, started_at desc);

create table if not exists public.tsnu_withdrawals (
  operation_id uuid primary key,
  shift_id uuid not null references public.tsnu_shift_sessions(id),
  user_id uuid not null references auth.users(id),
  materials jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists tsnu_withdrawals_shift on public.tsnu_withdrawals(shift_id, created_at);

-- Older installations may not yet have the idempotency identifier used by
-- newer stock movements. Several rows may share it (one per material).
alter table public.stock_movements add column if not exists operation_id uuid;
create index if not exists stock_movements_operation_id_idx
  on public.stock_movements(operation_id) where operation_id is not null;

alter table public.tsnu_units enable row level security;
alter table public.tsnu_unit_assignments enable row level security;
alter table public.tsnu_shift_sessions enable row level security;
alter table public.tsnu_withdrawals enable row level security;
revoke all on public.tsnu_units, public.tsnu_unit_assignments, public.tsnu_shift_sessions, public.tsnu_withdrawals from public, anon, authenticated;

insert into public.tsnu_units(lot,zone,unit)
select 'Lot 5 · Girona - Alt Maresme','Olot',u from unnest(array[
 'K1374','K1376','K1377','T1731','T1732','T1733','T1734','T1735','T1736',
 'T1737','T1738','T1739','T1740','T1741','T1742','T1743','T1744','KE1384','KE1388'
]) u on conflict do nothing;

insert into public.tsnu_unit_assignments(lot,zone,unit,warehouse_id)
select 'Lot 5 · Girona - Alt Maresme','Olot',u,
 case when u=any(array['K1376','K1377','T1731','T1732','T1733','T1734','T1735','T1736'])
      then 'lot5_olot_campdevanol' else 'lot5_olot_central' end
from unnest(array[
 'K1374','K1376','K1377','T1731','T1732','T1733','T1734','T1735','T1736',
 'T1737','T1738','T1739','T1740','T1741','T1742','T1743','T1744','KE1384','KE1388'
]) u on conflict (lot,unit) do nothing;

create or replace function public.require_current_tsnu_device(p_lot text,p_unit text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();
begin
 if v_user is null or not exists(
  select 1 from public.device_authorizations d join public.app_security_config c on c.singleton=true
  where d.user_id=v_user and d.active and d.lot=p_lot and d.unit=p_unit
    and d.authorization_version=c.authorization_version
 ) then raise exception 'DEVICE_NOT_AUTHORIZED'; end if;
 if not exists(select 1 from public.tsnu_units where lot=p_lot and unit=p_unit and active)
 then raise exception 'TSNU_UNIT_NOT_CONFIGURED'; end if;
 return v_user;
end $$;
revoke all on function public.require_current_tsnu_device(text,text) from public,anon,authenticated;

create or replace function public.configure_tsnu_assignment(
 p_admin_pin text,p_lot text,p_zone text,p_unit text,p_warehouse_id text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_name text;
begin
 if auth.uid() is null or public.verify_admin_pin(p_admin_pin) is distinct from true
 then raise exception 'ADMIN_PIN_REQUIRED'; end if;
 if not exists(select 1 from public.tsnu_units where lot=p_lot and zone=p_zone and unit=p_unit and active)
 then raise exception 'TSNU_UNIT_NOT_CONFIGURED'; end if;
 select name into v_name from public.warehouses
 where id=p_warehouse_id and lot=p_lot and zone=p_zone;
 if not found then raise exception 'WAREHOUSE_OUTSIDE_SCOPE'; end if;
 insert into public.tsnu_unit_assignments(lot,zone,unit,warehouse_id,updated_at)
 values(p_lot,p_zone,p_unit,p_warehouse_id,now())
 on conflict(lot,unit) do update set zone=excluded.zone,warehouse_id=excluded.warehouse_id,updated_at=now();
 return jsonb_build_object('lot',p_lot,'zone',p_zone,'unit',p_unit,'warehouse_id',p_warehouse_id,'warehouse',v_name);
end $$;
revoke all on function public.configure_tsnu_assignment(text,text,text,text,text) from public,anon;
grant execute on function public.configure_tsnu_assignment(text,text,text,text,text) to authenticated;

create or replace function public.get_my_tsnu_assignment()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_lot text;v_unit text;v_result jsonb;
begin
 select d.lot,d.unit into v_lot,v_unit from public.device_authorizations d
 join public.app_security_config c on c.singleton=true
 where d.user_id=auth.uid() and d.active and d.authorization_version=c.authorization_version;
 if not found then raise exception 'DEVICE_NOT_AUTHORIZED'; end if;
 select jsonb_build_object('lot',a.lot,'zone',a.zone,'unit',a.unit,'warehouse_id',a.warehouse_id,
  'warehouse',w.name,'checklist_version',a.checklist_version) into v_result
 from public.tsnu_unit_assignments a join public.warehouses w on w.id=a.warehouse_id
 where a.lot=v_lot and a.unit=v_unit;
 if v_result is null then raise exception 'TSNU_ASSIGNMENT_REQUIRED'; end if;
 return v_result;
end $$;
revoke all on function public.get_my_tsnu_assignment() from public,anon;
grant execute on function public.get_my_tsnu_assignment() to authenticated;

create or replace function public.start_tsnu_shift(p_shift_id uuid,p_started_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_lot text;v_unit text;v_assignment public.tsnu_unit_assignments%rowtype;v_existing public.tsnu_shift_sessions%rowtype;
begin
 if p_shift_id is null or p_started_at is null then raise exception 'INVALID_SHIFT'; end if;
 select lot,unit into v_lot,v_unit from public.device_authorizations d join public.app_security_config c on c.singleton=true
  where d.user_id=v_user and d.active and d.authorization_version=c.authorization_version;
 perform public.require_current_tsnu_device(v_lot,v_unit);
 select * into strict v_assignment from public.tsnu_unit_assignments where lot=v_lot and unit=v_unit;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text,51));
 select * into v_existing from public.tsnu_shift_sessions where id=p_shift_id;
 if found then
  if v_existing.user_id<>v_user then raise exception 'SHIFT_ID_CONFLICT'; end if;
  return to_jsonb(v_existing);
 end if;
 if exists(select 1 from public.tsnu_shift_sessions where user_id=v_user and ended_at is null)
 then raise exception 'OPEN_SHIFT_EXISTS'; end if;
 insert into public.tsnu_shift_sessions(id,user_id,lot,zone,unit,warehouse_id,checklist_version,started_at)
 values(p_shift_id,v_user,v_assignment.lot,v_assignment.zone,v_assignment.unit,v_assignment.warehouse_id,v_assignment.checklist_version,p_started_at)
 returning * into v_existing;
 return to_jsonb(v_existing);
end $$;
revoke all on function public.start_tsnu_shift(uuid,timestamptz) from public,anon;
grant execute on function public.start_tsnu_shift(uuid,timestamptz) to authenticated;

create or replace function public.submit_tsnu_checklist(p_shift_id uuid,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_shift public.tsnu_shift_sessions%rowtype;v_required text[]:=array[
 'Maleta de intervención precintada','DEA','Mantas de un solo uso','Sabanas de un solo uso',
 'Contenedor de agujas grande','Bolsas de vómito','Sonda de aspiración','Aspirador manual','Empapadores',
 'Cuña de hombre','Cuña de mujer','Bata EPI o mono de protección','Bolsas de residuos GII','Bolsas de basura negras',
 'Gafas de protección EPI','Guantes de protección EPI','Oxígeno disponible y con carga suficiente',
 'Guantes de nitrilo de diferentes tallas','Cadenas de nieve','Cizallas','Pata de cabra','Tarjeta de gasóleo','Tarjeta Trueta'];
begin
 select * into v_shift from public.tsnu_shift_sessions where id=p_shift_id for update;
 if not found or v_shift.user_id<>auth.uid() or v_shift.ended_at is not null then raise exception 'INVALID_OPEN_SHIFT'; end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'object'
 or exists(select 1 from unnest(v_required) x where p_answers->>x not in ('ok','issue'))
 or exists(select 1 from jsonb_object_keys(p_answers) x where not (x=any(v_required)))
 then raise exception 'INCOMPLETE_CHECKLIST'; end if;
 if v_shift.checklist_answers is not null and v_shift.checklist_answers<>p_answers then raise exception 'CHECKLIST_ALREADY_SUBMITTED'; end if;
 update public.tsnu_shift_sessions set checklist_answers=p_answers,
  checklist_submitted_at=coalesce(checklist_submitted_at,now()) where id=p_shift_id returning * into v_shift;
 return to_jsonb(v_shift);
end $$;
revoke all on function public.submit_tsnu_checklist(uuid,jsonb) from public,anon;
grant execute on function public.submit_tsnu_checklist(uuid,jsonb) to authenticated;

create or replace function public.append_tsnu_withdrawal(p_operation_id uuid,p_shift_id uuid,p_materials jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_shift public.tsnu_shift_sessions%rowtype;v_existing public.tsnu_withdrawals%rowtype;v_item record;v_quantity integer;
begin
 if p_operation_id is null or p_materials is null or jsonb_typeof(p_materials)<>'object' or p_materials='{}'::jsonb
 then raise exception 'INVALID_WITHDRAWAL'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,52));
 select * into v_existing from public.tsnu_withdrawals where operation_id=p_operation_id;
 if found then
  if v_existing.user_id<>auth.uid() or v_existing.shift_id<>p_shift_id or v_existing.materials<>p_materials
  then raise exception 'OPERATION_ID_CONFLICT'; end if;
  return to_jsonb(v_existing);
 end if;
 select * into v_shift from public.tsnu_shift_sessions where id=p_shift_id for update;
 if not found or v_shift.user_id<>auth.uid() or v_shift.ended_at is not null or v_shift.checklist_submitted_at is null
 then raise exception 'INVALID_OPEN_SHIFT'; end if;
 for v_item in select key,value from jsonb_each(p_materials) order by key loop
  if jsonb_typeof(v_item.value)<>'number' or v_item.value::text!~'^[1-9][0-9]*$'
  then raise exception 'INVALID_MATERIAL_QUANTITY'; end if;
  v_quantity:=(v_item.value::text)::integer;
  perform pg_advisory_xact_lock(hashtextextended(v_shift.warehouse_id||':'||v_item.key,1));
  update public.warehouse_inventory set quantity=quantity-v_quantity,
   pending_replenishment=pending_replenishment+v_quantity,updated_at=now()
   where warehouse_id=v_shift.warehouse_id and material=v_item.key;
  if not found then raise exception 'MATERIAL_NOT_IN_INVENTORY: %',v_item.key; end if;
  insert into public.stock_movements(warehouse_id,unit,guard_code,material,delta,movement_type,operation_id)
  values(v_shift.warehouse_id,v_shift.unit,to_char(v_shift.started_at at time zone 'Europe/Madrid','DDMMYY'),v_item.key,-v_quantity,'tsnu_withdrawal',p_operation_id);
 end loop;
 insert into public.tsnu_withdrawals(operation_id,shift_id,user_id,materials)
 values(p_operation_id,p_shift_id,auth.uid(),p_materials) returning * into v_existing;
 update public.device_authorizations set last_seen_at=now() where user_id=auth.uid();
 return to_jsonb(v_existing);
end $$;
revoke all on function public.append_tsnu_withdrawal(uuid,uuid,jsonb) from public,anon;
grant execute on function public.append_tsnu_withdrawal(uuid,uuid,jsonb) to authenticated;

create or replace function public.finish_tsnu_shift(p_shift_id uuid,p_ended_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_shift public.tsnu_shift_sessions%rowtype;
begin
 select * into v_shift from public.tsnu_shift_sessions where id=p_shift_id for update;
 if not found or v_shift.user_id<>auth.uid() then raise exception 'INVALID_SHIFT'; end if;
 if v_shift.checklist_submitted_at is null then raise exception 'CHECKLIST_REQUIRED'; end if;
 if v_shift.ended_at is not null then return to_jsonb(v_shift); end if;
 if p_ended_at is null or p_ended_at<v_shift.started_at then raise exception 'INVALID_END_TIME'; end if;
 update public.tsnu_shift_sessions set ended_at=p_ended_at where id=p_shift_id returning * into v_shift;
 return to_jsonb(v_shift);
end $$;
revoke all on function public.finish_tsnu_shift(uuid,timestamptz) from public,anon;
grant execute on function public.finish_tsnu_shift(uuid,timestamptz) to authenticated;

commit;
