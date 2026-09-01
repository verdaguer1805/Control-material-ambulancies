-- Autorització individual de dispositius per a Control de material.
-- 1. Executeu aquest fitxer a Supabase SQL Editor.
-- 2. Publiqueu la versió de l'app que inclou la pantalla d'activació.
-- 3. Des del panell d'administració, useu «Renovar codi dispositius».

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.app_security_config (
  singleton boolean primary key default true check (singleton),
  enforcement_enabled boolean not null default false,
  authorization_version integer not null default 0,
  activation_code_hash text,
  updated_at timestamptz not null default now()
);

insert into public.app_security_config (singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists public.device_authorizations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  unit text not null,
  lot text not null,
  authorization_version integer not null,
  active boolean not null default true,
  activated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.device_activation_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  attempts integer not null default 0,
  window_started_at timestamptz not null default now()
);

alter table public.app_security_config enable row level security;
alter table public.device_authorizations enable row level security;
alter table public.device_activation_attempts enable row level security;

revoke all on public.app_security_config from anon, authenticated;
revoke all on public.device_authorizations from anon, authenticated;
revoke all on public.device_activation_attempts from anon, authenticated;

create or replace function public.get_device_authorization()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_config public.app_security_config%rowtype;
  v_device public.device_authorizations%rowtype;
begin
  select * into v_config
  from public.app_security_config
  where singleton = true;

  if v_user_id is not null then
    select * into v_device
    from public.device_authorizations
    where user_id = v_user_id;
  end if;

  return jsonb_build_object(
    'enforcement_enabled', coalesce(v_config.enforcement_enabled, false),
    'current_version', coalesce(v_config.authorization_version, 0),
    'authorized', coalesce(v_device.active, false)
      and v_device.authorization_version = v_config.authorization_version,
    'unit', v_device.unit,
    'lot', v_device.lot,
    'device_version', v_device.authorization_version
  );
end;
$$;

create or replace function public.activate_device(
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
  v_attempt public.device_activation_attempts%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(p_unit), '') is null or nullif(btrim(p_lot), '') is null then
    raise exception 'Unit and lot are required';
  end if;

  select * into v_config
  from public.app_security_config
  where singleton = true
  for update;

  if not v_config.enforcement_enabled or v_config.activation_code_hash is null then
    raise exception 'DEVICE_SECURITY_NOT_CONFIGURED';
  end if;

  select * into v_attempt
  from public.device_activation_attempts
  where user_id = v_user_id
  for update;

  if v_attempt.window_started_at < now() - interval '15 minutes' then
    delete from public.device_activation_attempts where user_id = v_user_id;
    v_attempt := null;
  elsif coalesce(v_attempt.attempts, 0) >= 5 then
    raise exception 'DEVICE_ACTIVATION_LOCKED';
  end if;

  if extensions.crypt(p_activation_code, v_config.activation_code_hash)
      <> v_config.activation_code_hash then
    insert into public.device_activation_attempts (user_id, attempts, window_started_at)
    values (v_user_id, 1, now())
    on conflict (user_id) do update
      set attempts = public.device_activation_attempts.attempts + 1;
    raise exception 'INVALID_DEVICE_ACTIVATION_CODE';
  end if;

  delete from public.device_activation_attempts where user_id = v_user_id;
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

create or replace function public.is_device_authorized(p_unit text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not c.enforcement_enabled or exists (
    select 1
    from public.device_authorizations d
    where d.user_id = auth.uid()
      and d.active
      and d.authorization_version = c.authorization_version
      and d.unit = p_unit
  )
  from public.app_security_config c
  where c.singleton = true;
$$;

create or replace function public.rotate_device_activation_code(
  input_owner_code text,
  p_new_code text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_version integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.verify_owner_code(input_owner_code) then
    raise exception 'OWNER_AUTHORIZATION_REQUIRED';
  end if;
  if p_new_code !~ '^\d{8,12}$' then
    raise exception 'Activation code must contain 8 to 12 digits';
  end if;

  update public.app_security_config set
    enforcement_enabled = true,
    authorization_version = authorization_version + 1,
    activation_code_hash = extensions.crypt(p_new_code, extensions.gen_salt('bf')),
    updated_at = now()
  where singleton = true
  returning authorization_version into v_version;

  return v_version;
end;
$$;

-- Conserva la funció original com a implementació interna i posa davant una
-- comprovació obligatòria del dispositiu.
do $$
begin
  if to_regprocedure('public.save_guard_consumption_authorized_impl(text,text,text,timestamp with time zone,jsonb)') is null then
    alter function public.save_guard_consumption(text,text,text,timestamp with time zone,jsonb)
      rename to save_guard_consumption_authorized_impl;
  end if;
end;
$$;

revoke all on function public.save_guard_consumption_authorized_impl(text,text,text,timestamp with time zone,jsonb)
  from public, anon, authenticated;

create or replace function public.save_guard_consumption(
  p_incident_code text,
  p_unit text,
  p_warehouse text,
  p_occurred_at timestamptz,
  p_materials jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_device_authorized(p_unit) then
    raise exception 'DEVICE_NOT_AUTHORIZED';
  end if;
  update public.device_authorizations
    set last_seen_at = now()
    where user_id = auth.uid();
  return public.save_guard_consumption_authorized_impl(
    p_incident_code, p_unit, p_warehouse, p_occurred_at, p_materials
  );
end;
$$;

-- Evita que un client esquivi la funció fent INSERT directe.
drop policy if exists "Temporary device inserts" on public.incidents;
drop policy if exists "Authenticated devices can insert incidents" on public.incidents;
drop policy if exists "Authorized devices can insert incidents" on public.incidents;
create policy "Authorized devices can insert incidents"
  on public.incidents for insert to authenticated
  with check (
    auth.uid() is not null
    and created_by = auth.uid()
    and public.is_device_authorized(unit)
  );

revoke execute on function public.get_device_authorization() from public, anon;
revoke execute on function public.activate_device(text,text,text) from public, anon;
revoke execute on function public.is_device_authorized(text) from public, anon, authenticated;
revoke execute on function public.rotate_device_activation_code(text,text) from public, anon;
revoke execute on function public.save_guard_consumption(text,text,text,timestamp with time zone,jsonb) from public, anon;

grant execute on function public.get_device_authorization() to authenticated;
grant execute on function public.activate_device(text,text,text) to authenticated;
grant execute on function public.rotate_device_activation_code(text,text) to authenticated;
grant execute on function public.save_guard_consumption(text,text,text,timestamp with time zone,jsonb) to authenticated;
