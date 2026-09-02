-- Amplía a 13 caracteres los códigos administrativos alfanuméricos.
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
    if v_code !~ '^[A-Za-z0-9]{6,13}$' then raise exception 'INVALID_ACCESS_CODE'; end if;
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
  on conflict(access_key) do update set role=excluded.role,zone=excluded.zone,
    code_hash=excluded.code_hash,updated_at=now();
  delete from public.admin_access_sessions;
  return true;
end;
$$;
revoke execute on function public.configure_admin_access_codes(text,jsonb) from public,anon;
grant execute on function public.configure_admin_access_codes(text,jsonb) to authenticated;
