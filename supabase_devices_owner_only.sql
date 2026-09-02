-- La gestió de dispositius queda reservada exclusivament al propietari.
create or replace function public.list_authorized_devices_for_admin()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version integer;
begin
  if not public.admin_has_role(array['owner']) then
    raise exception 'ADMIN_ROLE_ACCESS_DENIED';
  end if;
  select authorization_version into v_version
  from public.app_security_config
  where singleton = true;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', d.user_id,
      'device_id', upper(right(replace(d.user_id::text, '-', ''), 8)),
      'unit', d.unit,
      'lot', d.lot,
      'active', d.active and d.authorization_version = v_version,
      'activated_at', d.activated_at,
      'last_seen_at', d.last_seen_at
    ) order by d.active desc, d.last_seen_at desc)
    from public.device_authorizations d
  ), '[]'::jsonb);
end;
$$;

create or replace function public.revoke_authorized_device_for_admin(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.admin_has_role(array['owner']) then
    raise exception 'ADMIN_ROLE_ACCESS_DENIED';
  end if;
  update public.device_authorizations
  set active = false, last_seen_at = now()
  where user_id = p_user_id and active = true;
  return found;
end;
$$;

revoke execute on function public.list_authorized_devices_for_admin() from public, anon;
revoke execute on function public.revoke_authorized_device_for_admin(uuid) from public, anon;
grant execute on function public.list_authorized_devices_for_admin() to authenticated;
grant execute on function public.revoke_authorized_device_for_admin(uuid) to authenticated;
