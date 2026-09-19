-- Sustitución segura de dispositivo: no cambia ninguna autorización al instalarse.
-- En una futura activación, revoca los dispositivos anteriores de la misma unidad
-- dentro del mismo lote y deja activo únicamente el nuevo.
begin;

create or replace function public.get_device_activation_preview(p_unit text, p_lot text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version integer;
  v_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(p_unit), '') is null or nullif(btrim(p_lot), '') is null then
    raise exception 'Unit and lot are required';
  end if;
  select authorization_version into v_version
  from public.app_security_config where singleton = true;
  select count(*) into v_count
  from public.device_authorizations
  where unit = p_unit and lot = p_lot and active
    and authorization_version = v_version and user_id <> auth.uid();
  return jsonb_build_object(
    'unit', p_unit,
    'lot', p_lot,
    'replacement_required', v_count > 0,
    'active_devices_to_revoke', v_count
  );
end;
$$;

revoke all on function public.get_device_activation_preview(text,text) from public, anon;
grant execute on function public.get_device_activation_preview(text,text) to authenticated;

create or replace function app_private.attempt_original_activate_device(
  p_activation_code text,
  p_unit text,
  p_lot text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_config public.app_security_config%rowtype;
begin
  if p_activation_code is null or p_activation_code !~ '^[0-9]{8,12}$' then
    raise exception 'INVALID_DEVICE_ACTIVATION_CODE';
  end if;
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(p_unit), '') is null or nullif(btrim(p_lot), '') is null then
    raise exception 'Unit and lot are required';
  end if;

  select * into v_config from public.app_security_config
  where singleton = true for update;
  if v_config.enforcement_enabled is distinct from true
     or nullif(v_config.activation_code_hash, '') is null then
    raise exception 'DEVICE_SECURITY_NOT_CONFIGURED';
  end if;
  if extensions.crypt(p_activation_code, v_config.activation_code_hash)
     is distinct from v_config.activation_code_hash then
    raise exception 'INVALID_DEVICE_ACTIVATION_CODE';
  end if;

  -- Serializa las activaciones de una misma unidad y lote.
  perform pg_advisory_xact_lock(hashtextextended(p_lot || ':' || p_unit, 73));

  update public.device_authorizations
  set active = false, last_seen_at = now()
  where unit = p_unit and lot = p_lot and active and user_id <> v_user_id;

  insert into public.device_authorizations
    (user_id, unit, lot, authorization_version, active, activated_at, last_seen_at)
  values
    (v_user_id, p_unit, p_lot, v_config.authorization_version, true, now(), now())
  on conflict (user_id) do update set
    unit = excluded.unit,
    lot = excluded.lot,
    authorization_version = excluded.authorization_version,
    active = true,
    activated_at = now(),
    last_seen_at = now();

  return public.get_device_authorization();
end;
$$;

revoke all on function app_private.attempt_original_activate_device(text,text,text)
from public, anon, authenticated;

commit;
