-- Access checks only: never called by consumption, sync, stock or device status.
-- Counters are per authenticated identity AND access purpose, not per unit.
-- Identity rotation requires an additional gateway/anti-abuse control.
begin;
create table if not exists app_private.access_attempt_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check(scope in ('activation','admin','owner','unit_pin')),
  failures integer not null default 0 check(failures between 0 and 2),
  cycles integer not null default 0 check(cycles between 0 and 5),
  blocked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key(user_id,scope)
);
alter table app_private.access_attempt_limits enable row level security;
revoke all on app_private.access_attempt_limits from public,anon,authenticated;

-- Preserve the existing implementations privately. Their exception handling is
-- enclosed in a subtransaction; the NEW counter is updated outside that block.
do $migration$
declare n text; definition text;
begin
  foreach n in array array['activate_device','open_admin_access_session'] loop
    if not exists(select 1 from pg_proc p join pg_namespace s on s.oid=p.pronamespace
      where s.nspname='app_private' and p.proname='attempt_original_'||n) then
      select pg_get_functiondef(p.oid) into strict definition
      from pg_proc p join pg_namespace s on s.oid=p.pronamespace
      where s.nspname='public' and p.proname=n;
      definition:=replace(definition,'FUNCTION public.'||n||'(',
        'FUNCTION app_private.attempt_original_'||n||'(');
      execute definition;
    end if;
  end loop;
end $migration$;
revoke all on function app_private.attempt_original_activate_device(text,text,text) from public,anon,authenticated;
revoke all on function app_private.attempt_original_open_admin_access_session(text) from public,anon,authenticated;

create or replace function public.get_access_attempt_status(p_scope text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare r app_private.access_attempt_limits%rowtype; seconds integer;
begin
  if auth.uid() is null or p_scope not in ('activation','admin','owner','unit_pin') then
    raise exception 'ACCESS_STATUS_DENIED';
  end if;
  select * into r from app_private.access_attempt_limits where user_id=auth.uid() and scope=p_scope;
  seconds:=greatest(0,ceil(extract(epoch from (r.blocked_until-clock_timestamp())))::integer);
  return jsonb_build_object('authorized',false,'retry_after_seconds',coalesce(seconds,0),
    'attempts_remaining',3-coalesce(r.failures,0),'failed_cycles',coalesce(r.cycles,0),
    'blocked_until',case when seconds>0 then r.blocked_until else null end);
end $$;
revoke all on function public.get_access_attempt_status(text) from public,anon;
grant execute on function public.get_access_attempt_status(text) to authenticated;

create or replace function app_private.check_access_attempt(p_scope text,p_code text,p_unit text default null,p_lot text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare r app_private.access_attempt_limits%rowtype; result jsonb; ok boolean:=false; err text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_scope not in ('activation','admin','owner','unit_pin') then raise exception 'INVALID_ACCESS_SCOPE'; end if;
  insert into app_private.access_attempt_limits(user_id,scope) values(auth.uid(),p_scope)
    on conflict(user_id,scope) do nothing;
  select * into strict r from app_private.access_attempt_limits
    where user_id=auth.uid() and scope=p_scope for update;
  if r.blocked_until>clock_timestamp() then return public.get_access_attempt_status(p_scope); end if;
  -- After the hour expires a new sequence of five cycles starts.
  if r.cycles>=5 then r.cycles:=0; r.failures:=0; end if;
  begin
    if p_code is null or length(p_code)=0 or length(p_code)>128 then
      ok:=false;
    elsif p_scope='activation' then
      delete from public.device_activation_attempts where user_id=auth.uid();
      result:=app_private.attempt_original_activate_device(p_code,p_unit,p_lot);
      ok:=coalesce((result->>'authorized')::boolean,false);
    elsif p_scope='admin' then
      delete from public.admin_access_attempts where user_id=auth.uid();
      result:=app_private.attempt_original_open_admin_access_session(p_code);
      ok:=coalesce((result->>'authorized')::boolean,false);
    elsif p_scope='owner' then
      select exists(select 1 from app_private.admin_security where singleton=true and owner_code=p_code) into ok;
    else
      select exists(select 1 from app_private.admin_security where singleton=true and admin_pin=p_code) into ok;
    end if;
  exception when raise_exception then
    get stacked diagnostics err=message_text;
    if err not in ('INVALID_DEVICE_ACTIVATION_CODE','INVALID_ADMIN_ACCESS_CODE') then raise; end if;
    ok:=false;
  end;
  if ok then
    update app_private.access_attempt_limits set failures=0,cycles=0,blocked_until=null,updated_at=clock_timestamp()
      where user_id=auth.uid() and scope=p_scope;
    return coalesce(result,jsonb_build_object('authorized',true));
  end if;
  r.failures:=r.failures+1;
  r.blocked_until:=null;
  if r.failures>=3 then
    r.failures:=0; r.cycles:=r.cycles+1;
    r.blocked_until:=clock_timestamp()+case when r.cycles>=5 then interval '1 hour' else interval '3 minutes' end;
  end if;
  update app_private.access_attempt_limits set failures=r.failures,cycles=r.cycles,
    blocked_until=r.blocked_until,updated_at=clock_timestamp() where user_id=auth.uid() and scope=p_scope;
  -- No RAISE here: returning a rejection commits the failed attempt.
  return public.get_access_attempt_status(p_scope)||jsonb_build_object('error','INVALID_ACCESS_CODE');
end $$;
revoke all on function app_private.check_access_attempt(text,text,text,text) from public,anon,authenticated;

create or replace function public.activate_device(p_activation_code text,p_unit text,p_lot text)
returns jsonb language sql volatile security definer set search_path=''
as $$select app_private.check_access_attempt('activation',p_activation_code,p_unit,p_lot)$$;
create or replace function public.open_admin_access_session(input_code text)
returns jsonb language sql volatile security definer set search_path=''
as $$select app_private.check_access_attempt('admin',input_code)$$;
create or replace function public.verify_owner_code(input_owner_code text)
returns boolean language sql volatile security definer set search_path=''
as $$select (app_private.check_access_attempt('owner',input_owner_code)->>'authorized')::boolean$$;
create or replace function public.verify_admin_pin(input_pin text)
returns boolean language sql volatile security definer set search_path=''
as $$select (app_private.check_access_attempt('unit_pin',input_pin)->>'authorized')::boolean$$;

-- Legacy callers must return a rejection instead of undoing the counter with
-- an exception. All their existing credential checks and successful paths stay.
do $migration$
declare f record; definition text;
begin
  for f in select p.oid from pg_proc p join pg_namespace s on s.oid=p.pronamespace
    where s.nspname='public' and p.prosrc like '%verify_owner_code(input_owner_code)%'
      and p.proname in ('rotate_device_activation_code','list_authorized_devices','revoke_authorized_device',
        'stage_admin_access_code','finalize_admin_access_codes','configure_admin_access_codes')
  loop
    definition:=pg_get_functiondef(f.oid);
    if position('raise exception ''OWNER_AUTHORIZATION_REQUIRED'';' in definition)>0 then
      definition:=replace(definition,'raise exception ''OWNER_AUTHORIZATION_REQUIRED'';','return null;');
      execute definition;
    elsif position('return null;' in definition)=0 then
      raise exception 'Unexpected owner check: review migration';
    end if;
  end loop;
end $migration$;

create or replace function public.change_admin_pin(input_owner_code text,input_current_pin text,input_new_pin text)
returns boolean language plpgsql security definer set search_path=''
as $$ begin
  if not public.verify_owner_code(input_owner_code) then return false; end if;
  if not public.verify_admin_pin(input_current_pin) then return false; end if;
  if input_new_pin is null or input_new_pin !~ '^[0-9]{4,8}$' then return false; end if;
  update app_private.admin_security set admin_pin=input_new_pin,updated_at=now()
    where singleton=true and owner_code=input_owner_code and admin_pin=input_current_pin;
  return found;
end $$;
-- Existing function ACLs are retained by CREATE OR REPLACE.
commit;
