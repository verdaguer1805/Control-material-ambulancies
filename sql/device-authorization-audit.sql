-- Auditoría inmutable de activaciones, sustituciones y revocaciones.
begin;
create table if not exists public.device_authorization_audit (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in ('activation','automatic_replacement','manual_revocation')),
  unit text not null, lot text not null, target_user_id uuid not null,
  actor_user_id uuid not null, actor_role text not null, actor_zone text,
  created_at timestamptz not null default now()
);
alter table public.device_authorization_audit enable row level security;
revoke all on public.device_authorization_audit from public, anon, authenticated;
create index if not exists device_authorization_audit_created_idx on public.device_authorization_audit(created_at desc);
create index if not exists device_authorization_audit_unit_idx on public.device_authorization_audit(lot,unit,created_at desc);

create or replace function public.revoke_authorized_device_for_admin(p_user_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_device public.device_authorizations%rowtype; v_role text; v_zone text;
begin
 if not public.admin_has_role(array['owner']) then raise exception 'ADMIN_ROLE_ACCESS_DENIED'; end if;
 select role,zone into v_role,v_zone
 from public.admin_access_sessions
 where user_id=auth.uid() and expires_at>now()
 order by created_at desc
 limit 1;
 update public.device_authorizations set active=false,last_seen_at=now() where user_id=p_user_id and active=true returning * into v_device;
 if not found then return false; end if;
 insert into public.device_authorization_audit(event_type,unit,lot,target_user_id,actor_user_id,actor_role,actor_zone)
 values('manual_revocation',v_device.unit,v_device.lot,v_device.user_id,auth.uid(),coalesce(v_role,'owner'),v_zone);
 return true;
end $$;
revoke all on function public.revoke_authorized_device_for_admin(uuid) from public,anon;
grant execute on function public.revoke_authorized_device_for_admin(uuid) to authenticated;

create or replace function app_private.attempt_original_activate_device(p_activation_code text,p_unit text,p_lot text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user_id uuid:=auth.uid(); v_config public.app_security_config%rowtype; v_replaced record;
begin
 if p_activation_code is null or p_activation_code !~ '^[0-9]{8,12}$' then raise exception 'INVALID_DEVICE_ACTIVATION_CODE'; end if;
 if v_user_id is null then raise exception 'Authentication required'; end if;
 if nullif(btrim(p_unit),'') is null or nullif(btrim(p_lot),'') is null then raise exception 'Unit and lot are required'; end if;
 select * into v_config from public.app_security_config where singleton=true for update;
 if v_config.enforcement_enabled is distinct from true or nullif(v_config.activation_code_hash,'') is null then raise exception 'DEVICE_SECURITY_NOT_CONFIGURED'; end if;
 if extensions.crypt(p_activation_code,v_config.activation_code_hash) is distinct from v_config.activation_code_hash then raise exception 'INVALID_DEVICE_ACTIVATION_CODE'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_lot||':'||p_unit,73));
 for v_replaced in update public.device_authorizations set active=false,last_seen_at=now()
   where unit=p_unit and lot=p_lot and active and user_id<>v_user_id returning user_id,unit,lot
 loop
  insert into public.device_authorization_audit(event_type,unit,lot,target_user_id,actor_user_id,actor_role)
  values('automatic_replacement',v_replaced.unit,v_replaced.lot,v_replaced.user_id,v_user_id,'device_activation');
 end loop;
 insert into public.device_authorizations(user_id,unit,lot,authorization_version,active,activated_at,last_seen_at)
 values(v_user_id,p_unit,p_lot,v_config.authorization_version,true,now(),now())
 on conflict(user_id) do update set unit=excluded.unit,lot=excluded.lot,authorization_version=excluded.authorization_version,active=true,activated_at=now(),last_seen_at=now();
 insert into public.device_authorization_audit(event_type,unit,lot,target_user_id,actor_user_id,actor_role)
 values('activation',p_unit,p_lot,v_user_id,v_user_id,'device_activation');
 return public.get_device_authorization();
end $$;
revoke all on function app_private.attempt_original_activate_device(text,text,text) from public,anon,authenticated;

create or replace function public.list_device_authorization_audit_for_admin()
returns table(event_type text,unit text,lot text,target_device text,actor_device text,actor_role text,actor_zone text,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 if not public.admin_has_role(array['owner']) then raise exception 'ADMIN_ROLE_ACCESS_DENIED'; end if;
 return query select a.event_type,a.unit,a.lot,left(a.target_user_id::text,8),left(a.actor_user_id::text,8),a.actor_role,a.actor_zone,a.created_at
 from public.device_authorization_audit a order by a.created_at desc limit 500;
end $$;
revoke all on function public.list_device_authorization_audit_for_admin() from public,anon;
grant execute on function public.list_device_authorization_audit_for_admin() to authenticated;
commit;
