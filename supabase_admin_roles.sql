-- Accesos por rol para administración, supervisión y logística.
-- Primera ejecución: el PIN antiguo continúa entrando como propietario hasta
-- que se configuren los seis códigos desde la versión nueva de la app.

create extension if not exists pgcrypto with schema extensions;
create schema if not exists app_private;

create table if not exists app_private.admin_access_codes (
  access_key text primary key,
  role text not null check (role in ('owner', 'logistics', 'supervisor')),
  zone text,
  code_hash text not null,
  updated_at timestamptz not null default now(),
  check ((role = 'supervisor' and zone is not null) or (role <> 'supervisor' and zone is null))
);

create table if not exists public.admin_access_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'logistics', 'supervisor')),
  zone text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_access_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  attempts integer not null default 0,
  window_started_at timestamptz not null default now()
);

create table if not exists public.unit_supervision_zones (
  unit text primary key,
  zone text not null
);

insert into public.unit_supervision_zones (unit, zone) values
  ('G204','Blanes'),('G218','Blanes'),('G217','Blanes'),('G440','Blanes'),
  ('G441','Blanes'),('G442','Blanes'),('G443','Blanes'),('G444','Blanes'),
  ('G445','Blanes'),('G446','Blanes'),('G471','Blanes'),('G422','Blanes'),
  ('G424','Blanes'),('G472','Blanes'),('G473','Blanes'),('G474','Blanes'),
  ('G475','Blanes'),('G476','Blanes'),('G477','Blanes'),('G478','Blanes'),
  ('BP51','Blanes'),('G307','Blanes'),('Material Supervisor · Blanes','Blanes'),
  ('SL51','Figueres'),('G216','Figueres'),('G206','Figueres'),('G460','Figueres'),
  ('G461','Figueres'),('G462','Figueres'),('G463','Figueres'),('G464','Figueres'),
  ('G465','Figueres'),('G466','Figueres'),('G467','Figueres'),('G468','Figueres'),
  ('G469','Figueres'),('G433','Figueres'),('G434','Figueres'),('G437','Figueres'),
  ('G306','Figueres'),('G303','Figueres'),('Material Supervisor · Figueres','Figueres'),
  ('SL50','Girona'),('G213','Girona'),('G202','Girona'),('G211','Girona'),
  ('G210','Girona'),('G212','Girona'),('G431','Girona'),('G432','Girona'),
  ('G435','Girona'),('G436','Girona'),('G438','Girona'),('G439','Girona'),
  ('G410','Girona'),('G411','Girona'),('G412','Girona'),('G414','Girona'),
  ('G415','Girona'),('G425','Girona'),('G420','Girona'),('G421','Girona'),
  ('G423','Girona'),('BP50','Girona'),('G300','Girona'),('Material Supervisor · Girona','Girona'),
  ('G205','Olot'),('G215','Olot'),('G450','Olot'),('G451','Olot'),
  ('BP52','Olot'),('G452','Olot'),('G453','Olot'),('G413','Olot'),
  ('G305','Olot'),('Material Supervisor · Olot','Olot')
on conflict (unit) do update set zone = excluded.zone;

alter table public.admin_access_sessions enable row level security;
alter table public.admin_access_attempts enable row level security;
alter table public.unit_supervision_zones enable row level security;
revoke all on app_private.admin_access_codes from public, anon, authenticated;
revoke all on public.admin_access_sessions from anon, authenticated;
revoke all on public.admin_access_attempts from anon, authenticated;
revoke all on public.unit_supervision_zones from anon, authenticated;

create or replace function public.current_admin_access()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select jsonb_build_object('authorized', true, 'role', role, 'zone', zone,
      'expires_at', expires_at)
    from public.admin_access_sessions
    where user_id = auth.uid() and expires_at > now()
  ), jsonb_build_object('authorized', false));
$$;

create or replace function public.admin_has_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_access_sessions
    where user_id = auth.uid() and expires_at > now() and role = any(p_roles)
  );
$$;

create or replace function public.admin_can_access_zone(p_zone text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_access_sessions
    where user_id = auth.uid() and expires_at > now()
      and (role in ('owner','logistics') or (role = 'supervisor' and zone = p_zone))
  );
$$;

create or replace function public.admin_can_access_unit(p_unit text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.admin_can_access_zone(z.zone)
  from public.unit_supervision_zones z where z.unit = p_unit;
$$;

create or replace function public.configure_admin_access_codes(
  input_owner_code text,
  p_codes jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_code text;
  v_codes text[] := array[]::text[];
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.verify_owner_code(input_owner_code) then raise exception 'OWNER_AUTHORIZATION_REQUIRED'; end if;
  foreach v_key in array array['owner','logistics','olot','figueres','blanes','girona'] loop
    v_code := p_codes ->> v_key;
    if v_code !~ '^[A-Za-z0-9]{6,12}$' then raise exception 'INVALID_ACCESS_CODE'; end if;
    if v_code = any(v_codes) then raise exception 'DUPLICATED_ACCESS_CODE'; end if;
    v_codes := array_append(v_codes, v_code);
  end loop;

  insert into app_private.admin_access_codes(access_key,role,zone,code_hash,updated_at)
  values
    ('owner','owner',null,extensions.crypt(p_codes->>'owner',extensions.gen_salt('bf')),now()),
    ('logistics','logistics',null,extensions.crypt(p_codes->>'logistics',extensions.gen_salt('bf')),now()),
    ('olot','supervisor','Olot',extensions.crypt(p_codes->>'olot',extensions.gen_salt('bf')),now()),
    ('figueres','supervisor','Figueres',extensions.crypt(p_codes->>'figueres',extensions.gen_salt('bf')),now()),
    ('blanes','supervisor','Blanes',extensions.crypt(p_codes->>'blanes',extensions.gen_salt('bf')),now()),
    ('girona','supervisor','Girona',extensions.crypt(p_codes->>'girona',extensions.gen_salt('bf')),now())
  on conflict(access_key) do update set role=excluded.role, zone=excluded.zone,
    code_hash=excluded.code_hash, updated_at=now();
  delete from public.admin_access_sessions;
  return true;
end;
$$;

create or replace function public.open_admin_access_session(input_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_access app_private.admin_access_codes%rowtype;
  v_attempt public.admin_access_attempts%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select * into v_attempt from public.admin_access_attempts where user_id=v_user for update;
  if v_attempt.window_started_at < now()-interval '15 minutes' then
    delete from public.admin_access_attempts where user_id=v_user;
  elsif coalesce(v_attempt.attempts,0) >= 5 then raise exception 'ADMIN_ACCESS_LOCKED';
  end if;

  select * into v_access from app_private.admin_access_codes
  where extensions.crypt(input_code,code_hash)=code_hash limit 1;
  if v_access.access_key is null and not exists(select 1 from app_private.admin_access_codes) then
    if public.verify_admin_pin(input_code) then
      v_access.role := 'owner'; v_access.zone := null; v_access.access_key := 'legacy';
    end if;
  end if;
  if v_access.access_key is null then
    insert into public.admin_access_attempts(user_id,attempts,window_started_at)
    values(v_user,1,now()) on conflict(user_id) do update
      set attempts=public.admin_access_attempts.attempts+1;
    raise exception 'INVALID_ADMIN_ACCESS_CODE';
  end if;
  delete from public.admin_access_attempts where user_id=v_user;
  insert into public.admin_access_sessions(user_id,role,zone,expires_at,created_at)
  values(v_user,v_access.role,v_access.zone,now()+interval '12 hours',now())
  on conflict(user_id) do update set role=excluded.role,zone=excluded.zone,
    expires_at=excluded.expires_at,created_at=now();
  return public.current_admin_access();
end;
$$;

create or replace function public.close_admin_access_session()
returns void language sql security definer set search_path=''
as $$ delete from public.admin_access_sessions where user_id=auth.uid(); $$;

-- Lecturas limitadas por rol y zona.
drop policy if exists "Temporary admin-panel reads" on public.incidents;
create policy "Role based admin incident reads" on public.incidents
  for select to authenticated using (public.admin_can_access_unit(unit));

drop policy if exists "Authenticated users can read warehouses" on public.warehouses;
create policy "Role based warehouse reads" on public.warehouses
  for select to authenticated using (public.admin_can_access_zone(zone));

drop policy if exists "Authenticated users can read inventory" on public.warehouse_inventory;
create policy "Role based inventory reads" on public.warehouse_inventory
  for select to authenticated using (exists(select 1 from public.warehouses w
    where w.id=warehouse_id and public.admin_can_access_zone(w.zone)));

drop policy if exists "Authenticated users can read movements" on public.stock_movements;
create policy "Role based movement reads" on public.stock_movements
  for select to authenticated using (exists(select 1 from public.warehouses w
    where w.id=warehouse_id and public.admin_can_access_zone(w.zone)));

drop policy if exists "Authenticated users can read guard submissions" on public.guard_submissions;
create policy "Role based submission reads" on public.guard_submissions
  for select to authenticated using (public.admin_can_access_unit(unit));

drop policy if exists "Authenticated users can read assignments" on public.unit_warehouse_assignments;
create policy "Role based assignment reads" on public.unit_warehouse_assignments
  for select to authenticated using (exists(select 1 from public.warehouses w
    where w.id=warehouse_id and public.admin_can_access_zone(w.zone)));

create or replace function public.require_admin_warehouse(p_warehouse_id text)
returns void language plpgsql security definer set search_path=''
as $$ declare v_zone text; begin
  select zone into v_zone from public.warehouses where id=p_warehouse_id;
  if v_zone is null or not public.admin_can_access_zone(v_zone) then raise exception 'ADMIN_ZONE_ACCESS_DENIED'; end if;
end; $$;

-- Conserva las funciones de stock actuales y añade autorización delante.
do $$ begin
  if to_regprocedure('public.set_inventory_quantity_role_impl(text,text,integer)') is null then
    alter function public.set_inventory_quantity(text,text,integer) rename to set_inventory_quantity_role_impl;
  end if;
  if to_regprocedure('public.receive_central_stock_role_impl(text,jsonb)') is null then
    alter function public.receive_central_stock(text,jsonb) rename to receive_central_stock_role_impl;
  end if;
  if to_regprocedure('public.transfer_stock_role_impl(text,text,jsonb)') is null then
    alter function public.transfer_stock(text,text,jsonb) rename to transfer_stock_role_impl;
  end if;
  if to_regprocedure('public.initialize_olot_inventory_role_impl(jsonb)') is null then
    alter function public.initialize_olot_inventory(jsonb) rename to initialize_olot_inventory_role_impl;
  end if;
end $$;

revoke all on function public.set_inventory_quantity_role_impl(text,text,integer) from public,anon,authenticated;
revoke all on function public.receive_central_stock_role_impl(text,jsonb) from public,anon,authenticated;
revoke all on function public.transfer_stock_role_impl(text,text,jsonb) from public,anon,authenticated;
revoke all on function public.initialize_olot_inventory_role_impl(jsonb) from public,anon,authenticated;

create or replace function public.set_inventory_quantity(p_warehouse_id text,p_material text,p_quantity integer)
returns void language plpgsql security definer set search_path=''
as $$ begin perform public.require_admin_warehouse(p_warehouse_id);
  perform public.set_inventory_quantity_role_impl(p_warehouse_id,p_material,p_quantity); end; $$;
create or replace function public.receive_central_stock(p_warehouse_id text,p_items jsonb)
returns void language plpgsql security definer set search_path=''
as $$ begin perform public.require_admin_warehouse(p_warehouse_id);
  perform public.receive_central_stock_role_impl(p_warehouse_id,p_items); end; $$;
create or replace function public.transfer_stock(p_origin_id text,p_destination_id text,p_items jsonb)
returns void language plpgsql security definer set search_path=''
as $$ begin perform public.require_admin_warehouse(p_origin_id); perform public.require_admin_warehouse(p_destination_id);
  perform public.transfer_stock_role_impl(p_origin_id,p_destination_id,p_items); end; $$;
create or replace function public.initialize_olot_inventory(p_materials jsonb)
returns integer language plpgsql security definer set search_path=''
as $$ begin if not public.admin_can_access_zone('Olot') then raise exception 'ADMIN_ZONE_ACCESS_DENIED'; end if;
  return public.initialize_olot_inventory_role_impl(p_materials); end; $$;

create or replace function public.list_authorized_devices_for_admin()
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_version integer; begin
  if not public.admin_has_role(array['owner','logistics']) then raise exception 'ADMIN_ROLE_ACCESS_DENIED'; end if;
  select authorization_version into v_version from public.app_security_config where singleton=true;
  return coalesce((select jsonb_agg(jsonb_build_object('user_id',d.user_id,'device_id',upper(right(replace(d.user_id::text,'-',''),8)),
    'unit',d.unit,'lot',d.lot,'active',d.active and d.authorization_version=v_version,
    'activated_at',d.activated_at,'last_seen_at',d.last_seen_at) order by d.active desc,d.last_seen_at desc)
    from public.device_authorizations d),'[]'::jsonb);
end; $$;

create or replace function public.revoke_authorized_device_for_admin(p_user_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$ begin if not public.admin_has_role(array['owner','logistics']) then raise exception 'ADMIN_ROLE_ACCESS_DENIED'; end if;
  update public.device_authorizations set active=false,last_seen_at=now() where user_id=p_user_id and active=true;
  return found; end; $$;

revoke execute on function public.current_admin_access() from public,anon;
revoke execute on function public.admin_has_role(text[]) from public,anon,authenticated;
revoke execute on function public.admin_can_access_zone(text) from public,anon,authenticated;
revoke execute on function public.admin_can_access_unit(text) from public,anon,authenticated;
revoke execute on function public.require_admin_warehouse(text) from public,anon,authenticated;
revoke execute on function public.configure_admin_access_codes(text,jsonb) from public,anon;
revoke execute on function public.open_admin_access_session(text) from public,anon;
revoke execute on function public.close_admin_access_session() from public,anon;
revoke execute on function public.list_authorized_devices_for_admin() from public,anon;
revoke execute on function public.revoke_authorized_device_for_admin(uuid) from public,anon;
grant execute on function public.current_admin_access() to authenticated;
grant execute on function public.configure_admin_access_codes(text,jsonb) to authenticated;
grant execute on function public.open_admin_access_session(text) to authenticated;
grant execute on function public.close_admin_access_session() to authenticated;
grant execute on function public.list_authorized_devices_for_admin() to authenticated;
grant execute on function public.revoke_authorized_device_for_admin(uuid) to authenticated;
grant execute on function public.set_inventory_quantity(text,text,integer) to authenticated;
grant execute on function public.receive_central_stock(text,jsonb) to authenticated;
grant execute on function public.transfer_stock(text,text,jsonb) to authenticated;
grant execute on function public.initialize_olot_inventory(jsonb) to authenticated;
