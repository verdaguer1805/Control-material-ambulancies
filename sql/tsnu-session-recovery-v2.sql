-- Recuperación TSNU v2: si el pendiente nuevo todavía no existe en servidor,
-- cierra únicamente la sesión abierta anterior del mismo dispositivo/unidad.
begin;

create or replace function public.recover_my_tsnu_session(
  p_admin_pin text,
  p_shift_id uuid
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_shift public.tsnu_shift_sessions%rowtype;
  v_lot text;
  v_unit text;
  v_recovered_ids uuid[];
begin
  if auth.uid() is null or public.verify_admin_pin(p_admin_pin) is distinct from true then
    raise exception 'ADMIN_PIN_REQUIRED';
  end if;

  select d.lot,d.unit into v_lot,v_unit
  from public.device_authorizations d
  join public.app_security_config c on c.singleton=true
  where d.user_id=auth.uid() and d.active
    and d.authorization_version=c.authorization_version;
  if not found then raise exception 'DEVICE_NOT_AUTHORIZED'; end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,53));
  select * into v_shift from public.tsnu_shift_sessions where id=p_shift_id for update;

  if found then
    if v_shift.user_id<>auth.uid() or v_shift.lot<>v_lot or v_shift.unit<>v_unit then
      raise exception 'RECOVERY_SCOPE_MISMATCH';
    end if;
    update public.tsnu_shift_sessions
    set ended_at=coalesce(ended_at,now()),close_source=coalesce(close_source,'recovery'),
        recovered_at=coalesce(recovered_at,now()),
        recovery_reason=coalesce(recovery_reason,'SUPERVISED_DEVICE_RECOVERY')
    where id=p_shift_id returning * into v_shift;
    return jsonb_build_object('shift_id',v_shift.id,'server_session',true,
      'recovered',true,'ended_at',v_shift.ended_at);
  end if;

  -- OPEN_SHIFT_EXISTS can occur before the new local id reaches the server.
  -- Only this authenticated device, lot and unit are affected.
  with recovered as (
    update public.tsnu_shift_sessions
    set ended_at=now(),close_source=coalesce(close_source,'recovery'),
        recovered_at=coalesce(recovered_at,now()),
        recovery_reason=coalesce(recovery_reason,'STALE_OPEN_SHIFT_BEFORE_LOCAL_START')
    where user_id=auth.uid() and lot=v_lot and unit=v_unit and ended_at is null
    returning id
  ) select array_agg(id) into v_recovered_ids from recovered;

  return jsonb_build_object('shift_id',p_shift_id,'server_session',false,
    'recovered',true,'closed_previous',coalesce(to_jsonb(v_recovered_ids),'[]'::jsonb));
end
$$;

revoke all on function public.recover_my_tsnu_session(text,uuid) from public,anon;
grant execute on function public.recover_my_tsnu_session(text,uuid) to authenticated;

commit;
