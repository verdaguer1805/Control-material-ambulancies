-- Recuperación supervisada TSNU. Aditiva: no elimina consumos ni movimientos.
begin;

alter table public.tsnu_shift_sessions
  add column if not exists recovered_at timestamptz,
  add column if not exists recovery_reason text;

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
begin
  if auth.uid() is null or public.verify_admin_pin(p_admin_pin) is distinct from true then
    raise exception 'ADMIN_PIN_REQUIRED';
  end if;

  select d.lot,d.unit into v_lot,v_unit
  from public.device_authorizations d
  join public.app_security_config c on c.singleton=true
  where d.user_id=auth.uid()
    and d.active
    and d.authorization_version=c.authorization_version;
  if not found then raise exception 'DEVICE_NOT_AUTHORIZED'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_shift_id::text,53));
  select * into v_shift from public.tsnu_shift_sessions where id=p_shift_id for update;

  -- An operation may have failed before the session was ever created. In
  -- that case recovery is still successful and only the local queue is reset.
  if not found then
    return jsonb_build_object('shift_id',p_shift_id,'server_session',false,'recovered',true);
  end if;

  if v_shift.user_id<>auth.uid() or v_shift.lot<>v_lot or v_shift.unit<>v_unit then
    raise exception 'RECOVERY_SCOPE_MISMATCH';
  end if;

  update public.tsnu_shift_sessions
  set ended_at=coalesce(ended_at,now()),
      recovered_at=coalesce(recovered_at,now()),
      recovery_reason=coalesce(recovery_reason,'SUPERVISED_DEVICE_RECOVERY')
  where id=p_shift_id
  returning * into v_shift;

  return jsonb_build_object(
    'shift_id',v_shift.id,
    'server_session',true,
    'recovered',true,
    'ended_at',v_shift.ended_at
  );
end
$$;

revoke all on function public.recover_my_tsnu_session(text,uuid) from public,anon;
grant execute on function public.recover_my_tsnu_session(text,uuid) to authenticated;

commit;
