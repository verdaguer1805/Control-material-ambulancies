-- Reviewed against deployed consumption function on 2026-09-17.
-- Does not delete incidents, reset inventory, or change existing authorization.
begin;
create table if not exists public.device_guard_recovery (
 unit text not null, guard_code text not null, lot text not null,
 user_id uuid not null references auth.users(id),
 activation_at timestamptz not null, token uuid not null default gen_random_uuid(),
 primary key(unit,guard_code)
);
alter table public.device_guard_recovery enable row level security;
revoke all on public.device_guard_recovery from public,anon,authenticated;

create or replace function public.require_single_consumption_device(p_unit text,p_lot text)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare v_activation timestamptz; v_count integer;
begin
 -- Locks serialize activation/revocation with the write authorization check.
 perform 1 from public.app_security_config where singleton=true for share;
 -- Lock exclusively before the guard lock: two simultaneous saves must not
 -- both hold a shared device lock and deadlock when updating last_seen_at.
 perform 1 from public.device_authorizations where unit=p_unit and lot=p_lot order by user_id for update;
 select d.activated_at into v_activation from public.device_authorizations d
 join public.app_security_config c on c.singleton=true
 where d.user_id=auth.uid() and d.unit=p_unit and d.lot=p_lot
 and d.active and d.authorization_version=c.authorization_version;
 if not found then raise exception 'DEVICE_NOT_AUTHORIZED'; end if;
 select count(*) into v_count from public.device_authorizations d
 join public.app_security_config c on c.singleton=true
 where d.unit=p_unit and d.lot=p_lot and d.active and d.authorization_version=c.authorization_version;
 if v_count<>1 then raise exception 'MULTIPLE_ACTIVE_DEVICES'; end if;
 if not exists(select 1 from public.unit_warehouse_assignments a join public.warehouses w on w.id=a.warehouse_id where a.unit=p_unit and w.lot=p_lot)
 then raise exception 'UNIT_WAREHOUSE_NOT_CONFIGURED'; end if;
 return v_activation;
end $$;
revoke all on function public.require_single_consumption_device(text,text) from public,anon,authenticated;

create or replace function public.recover_guard_consumption(p_unit text,p_lot text,p_guard_code text,p_occurred_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_activation timestamptz; v_inc public.incidents%rowtype; v_session public.device_guard_recovery%rowtype;
begin
 if p_guard_code is null or p_guard_code !~ '^\d{6}$' or p_occurred_at is null
 or to_char(p_occurred_at at time zone 'Europe/Madrid','DDMMYY')<>p_guard_code then raise exception 'INVALID_GUARD'; end if;
 v_activation:=public.require_single_consumption_device(p_unit,p_lot);
 perform pg_advisory_xact_lock(hashtextextended(p_unit||':'||p_guard_code,0));
 select * into v_inc from public.incidents where unit=p_unit and incident_code=p_guard_code order by created_at desc limit 1;
 if v_inc.id is not null and v_inc.occurred_at is distinct from p_occurred_at then raise exception 'GUARD_START_MISMATCH'; end if;
 select * into v_session from public.device_guard_recovery where unit=p_unit and guard_code=p_guard_code;
 if not found or v_session.user_id<>auth.uid() or v_session.activation_at<>v_activation or v_session.lot<>p_lot then
  insert into public.device_guard_recovery(unit,guard_code,lot,user_id,activation_at)
  values(p_unit,p_guard_code,p_lot,auth.uid(),v_activation)
  on conflict(unit,guard_code) do update set lot=excluded.lot,user_id=excluded.user_id,activation_at=excluded.activation_at,token=gen_random_uuid()
  returning * into v_session;
 end if;
 return jsonb_build_object('token',v_session.token,'unit',p_unit,'lot',p_lot,'guard_code',p_guard_code,
  'occurred_at',p_occurred_at,'materials',coalesce(v_inc.materials,'{}'::jsonb),'incident_id',v_inc.id,'user_id',auth.uid());
end $$;
revoke all on function public.recover_guard_consumption(text,text,text,timestamptz) from public,anon;
grant execute on function public.recover_guard_consumption(text,text,text,timestamptz) to authenticated;

create or replace function public.save_recovered_guard_consumption(p_token uuid,p_unit text,p_lot text,p_guard_code text,p_occurred_at timestamptz,p_materials jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_activation timestamptz; v_session public.device_guard_recovery%rowtype; v_inc public.incidents%rowtype; v_item record; v_warehouse text; v_id uuid;
begin
 v_activation:=public.require_single_consumption_device(p_unit,p_lot);
 perform pg_advisory_xact_lock(hashtextextended(p_unit||':'||p_guard_code,0));
 select * into v_session from public.device_guard_recovery where unit=p_unit and guard_code=p_guard_code;
 if not found or p_token is null or v_session.token<>p_token or v_session.user_id<>auth.uid()
 or v_session.activation_at<>v_activation or v_session.lot<>p_lot then raise exception 'GUARD_RECOVERY_REQUIRED'; end if;
 if p_materials is null or jsonb_typeof(p_materials)<>'object' or p_occurred_at is null
 or to_char(p_occurred_at at time zone 'Europe/Madrid','DDMMYY')<>p_guard_code then raise exception 'INVALID_GUARD'; end if;
 for v_item in select key,value from jsonb_each(p_materials) loop
  if v_item.key='' or jsonb_typeof(v_item.value)<>'number' or v_item.value::text !~ '^[0-9]+$'
    or (v_item.value::text)::numeric>2147483647 then raise exception 'INVALID_MATERIAL_QUANTITY'; end if;
 end loop;
 select * into v_inc from public.incidents where unit=p_unit and incident_code=p_guard_code order by created_at desc limit 1 for update;
 if v_inc.id is not null then
  if v_inc.occurred_at is distinct from p_occurred_at then raise exception 'GUARD_START_MISMATCH'; end if;
  for v_item in select key,value from jsonb_each_text(v_inc.materials) loop
   if coalesce((p_materials->>v_item.key)::numeric,0)<v_item.value::numeric then raise exception 'STALE_GUARD_TOTAL'; end if;
  end loop;
  if v_inc.materials=p_materials then return v_inc.id; end if;
 end if;
 select w.name into strict v_warehouse from public.unit_warehouse_assignments a join public.warehouses w on w.id=a.warehouse_id where a.unit=p_unit and w.lot=p_lot;
 v_id:=public.save_guard_consumption_authorized_impl(p_guard_code,p_unit,v_warehouse,p_occurred_at,p_materials);
 update public.device_authorizations set last_seen_at=now() where user_id=auth.uid();
 return v_id;
end $$;
revoke all on function public.save_recovered_guard_consumption(uuid,text,text,text,timestamptz,jsonb) from public,anon;
grant execute on function public.save_recovered_guard_consumption(uuid,text,text,text,timestamptz,jsonb) to authenticated;

-- Older clients continue only for their original untouched guard. They cannot
-- replace a previous device's totals or bypass an established recovery session.
create or replace function public.save_guard_consumption(p_incident_code text,p_unit text,p_warehouse text,p_occurred_at timestamptz,p_materials jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_lot text; v_inc public.incidents%rowtype;
begin
 select lot into v_lot from public.device_authorizations where user_id=auth.uid();
 perform public.require_single_consumption_device(p_unit,v_lot);
 perform pg_advisory_xact_lock(hashtextextended(p_unit||':'||p_incident_code,0));
 if exists(select 1 from public.device_guard_recovery where unit=p_unit and guard_code=p_incident_code)
 then raise exception 'CLIENT_UPGRADE_REQUIRED'; end if;
 select * into v_inc from public.incidents where unit=p_unit and incident_code=p_incident_code order by created_at desc limit 1;
 if v_inc.id is not null and v_inc.created_by is distinct from auth.uid() then raise exception 'GUARD_RECOVERY_REQUIRED'; end if;
 update public.device_authorizations set last_seen_at=now() where user_id=auth.uid();
 return public.save_guard_consumption_authorized_impl(p_incident_code,p_unit,p_warehouse,p_occurred_at,p_materials);
end $$;
revoke all on function public.save_guard_consumption(text,text,text,timestamptz,jsonb) from public,anon;
grant execute on function public.save_guard_consumption(text,text,text,timestamptz,jsonb) to authenticated;
commit;
