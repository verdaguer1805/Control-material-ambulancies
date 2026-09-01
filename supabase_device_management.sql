-- Gestión segura de dispositivos oficiales.
-- Ejecutar una sola vez en Supabase SQL Editor después de supabase_device_security.sql.

create or replace function public.list_authorized_devices(input_owner_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_current_version integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.verify_owner_code(input_owner_code) then
    raise exception 'OWNER_AUTHORIZATION_REQUIRED';
  end if;

  select authorization_version into v_current_version
  from public.app_security_config
  where singleton = true;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', d.user_id,
      'device_id', upper(right(replace(d.user_id::text, '-', ''), 8)),
      'unit', d.unit,
      'lot', d.lot,
      'active', d.active and d.authorization_version = v_current_version,
      'activated_at', d.activated_at,
      'last_seen_at', d.last_seen_at
    ) order by d.active desc, d.last_seen_at desc)
    from public.device_authorizations d
  ), '[]'::jsonb);
end;
$$;

create or replace function public.revoke_authorized_device(
  input_owner_code text,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.verify_owner_code(input_owner_code) then
    raise exception 'OWNER_AUTHORIZATION_REQUIRED';
  end if;

  update public.device_authorizations
    set active = false, last_seen_at = now()
    where user_id = p_user_id and active = true;
  return found;
end;
$$;

revoke execute on function public.list_authorized_devices(text) from public, anon;
revoke execute on function public.revoke_authorized_device(text,uuid) from public, anon;
grant execute on function public.list_authorized_devices(text) to authenticated;
grant execute on function public.revoke_authorized_device(text,uuid) to authenticated;
