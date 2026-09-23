-- Permite que el dispositivo autorizado sustituya el total acumulado de su
-- guardia. El token de recuperación, la unidad y la autorización vigente
-- siguen siendo obligatorios; únicamente se elimina la antigua restricción
-- que impedía reducir una cantidad ya enviada.
begin;

create or replace function public.save_recovered_guard_consumption(
  p_token uuid,
  p_unit text,
  p_lot text,
  p_guard_code text,
  p_occurred_at timestamptz,
  p_materials jsonb
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_activation timestamptz;
  v_session public.device_guard_recovery%rowtype;
  v_inc public.incidents%rowtype;
  v_item record;
  v_warehouse text;
  v_id uuid;
begin
  v_activation := public.require_single_consumption_device(p_unit,p_lot);
  perform pg_advisory_xact_lock(hashtextextended(p_unit||':'||p_guard_code,0));
  select * into v_session
  from public.device_guard_recovery
  where unit=p_unit and guard_code=p_guard_code;
  if not found or p_token is null or v_session.token<>p_token
    or v_session.user_id<>auth.uid() or v_session.activation_at<>v_activation
    or v_session.lot<>p_lot then
    raise exception 'GUARD_RECOVERY_REQUIRED';
  end if;
  if p_materials is null or jsonb_typeof(p_materials)<>'object'
    or p_occurred_at is null
    or to_char(p_occurred_at at time zone 'Europe/Madrid','DDMMYY')<>p_guard_code then
    raise exception 'INVALID_GUARD';
  end if;
  for v_item in select key,value from jsonb_each(p_materials) loop
    if v_item.key='' or jsonb_typeof(v_item.value)<>'number'
      or v_item.value::text !~ '^[0-9]+$'
      or (v_item.value::text)::numeric>2147483647 then
      raise exception 'INVALID_MATERIAL_QUANTITY';
    end if;
  end loop;
  select * into v_inc
  from public.incidents
  where unit=p_unit and incident_code=p_guard_code
  order by created_at desc limit 1 for update;
  if v_inc.id is not null and v_inc.occurred_at is distinct from p_occurred_at then
    raise exception 'GUARD_START_MISMATCH';
  end if;
  if v_inc.id is not null and v_inc.materials=p_materials then return v_inc.id; end if;
  select w.name into strict v_warehouse
  from public.unit_warehouse_assignments a
  join public.warehouses w on w.id=a.warehouse_id
  where a.unit=p_unit and w.lot=p_lot;
  v_id := public.save_guard_consumption_authorized_impl(
    p_guard_code,p_unit,v_warehouse,p_occurred_at,p_materials
  );
  update public.device_authorizations set last_seen_at=now() where user_id=auth.uid();
  return v_id;
end;
$$;

revoke all on function public.save_recovered_guard_consumption(uuid,text,text,text,timestamptz,jsonb)
  from public,anon;
grant execute on function public.save_recovered_guard_consumption(uuid,text,text,text,timestamptz,jsonb)
  to authenticated;

commit;
