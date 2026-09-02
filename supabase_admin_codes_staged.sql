-- Configuración escalonada de códigos administrativos.
-- Evita que PostgREST agote el tiempo de espera al cifrar seis códigos juntos.

create table if not exists app_private.admin_access_code_staging (
  user_id uuid not null,
  access_key text not null check (access_key in ('owner','logistics','olot','figueres','blanes','girona')),
  role text not null check (role in ('owner','logistics','supervisor')),
  zone text,
  code_hash text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, access_key)
);

create or replace function public.stage_admin_access_code(
  input_owner_code text,
  p_access_key text,
  p_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_zone text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.verify_owner_code(input_owner_code) then raise exception 'OWNER_AUTHORIZATION_REQUIRED'; end if;
  if p_code !~ '^[A-Za-z0-9]{6,13}$' then raise exception 'INVALID_ACCESS_CODE'; end if;

  select x.role, x.zone into v_role, v_zone
  from (values
    ('owner','owner',null::text),
    ('logistics','logistics',null::text),
    ('olot','supervisor','Olot'),
    ('figueres','supervisor','Figueres'),
    ('blanes','supervisor','Blanes'),
    ('girona','supervisor','Girona')
  ) as x(access_key,role,zone)
  where x.access_key = p_access_key;

  if v_role is null then raise exception 'INVALID_ACCESS_KEY'; end if;

  insert into app_private.admin_access_code_staging(user_id,access_key,role,zone,code_hash,updated_at)
  values (auth.uid(),p_access_key,v_role,v_zone,extensions.crypt(p_code,extensions.gen_salt('bf')),now())
  on conflict(user_id,access_key) do update set
    role=excluded.role, zone=excluded.zone, code_hash=excluded.code_hash, updated_at=now();
  return true;
end;
$$;

create or replace function public.finalize_admin_access_codes(input_owner_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.verify_owner_code(input_owner_code) then raise exception 'OWNER_AUTHORIZATION_REQUIRED'; end if;
  if (select count(*) from app_private.admin_access_code_staging where user_id=auth.uid()) <> 6 then
    raise exception 'INCOMPLETE_ACCESS_CODES';
  end if;

  insert into app_private.admin_access_codes(access_key,role,zone,code_hash,updated_at)
  select access_key,role,zone,code_hash,now()
  from app_private.admin_access_code_staging where user_id=auth.uid()
  on conflict(access_key) do update set role=excluded.role,zone=excluded.zone,
    code_hash=excluded.code_hash,updated_at=now();

  delete from app_private.admin_access_code_staging where user_id=auth.uid();
  delete from public.admin_access_sessions;
  return true;
end;
$$;

revoke execute on function public.stage_admin_access_code(text,text,text) from public,anon;
revoke execute on function public.finalize_admin_access_codes(text) from public,anon;
grant execute on function public.stage_admin_access_code(text,text,text) to authenticated;
grant execute on function public.finalize_admin_access_codes(text) to authenticated;
