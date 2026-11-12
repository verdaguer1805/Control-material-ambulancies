-- Ejecutar completo en SQL Editor. No contiene contraseñas.
-- No modifica stock, históricos, dispositivos ni sesiones de las unidades.
begin;
alter table public.admin_access_sessions add column if not exists access_key text;
alter table public.stock_movements add column if not exists performed_name text;

create or replace function public.current_admin_access()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_build_object('authorized',true,'role',role,'zone',zone,'expires_at',expires_at,
 'display_name',case when access_key='zoraida' then 'Zoraida' when role='reports_viewer' then 'SOTS-CAP PICORNELL' else null end)
 from public.admin_access_sessions where user_id=auth.uid() and expires_at>now()),jsonb_build_object('authorized',false));
$$;

-- Mantiene el control de intentos existente. Identifica SOLO después de validar.
create or replace function public.open_admin_access_session(input_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; matched_key text;
begin
 result:=app_private.check_access_attempt('admin',input_code);
 if not coalesce((result->>'authorized')::boolean,false) then return result; end if;
 select access_key into matched_key from app_private.admin_access_codes
 where extensions.crypt(input_code,code_hash)=code_hash limit 1;
 update public.admin_access_sessions set access_key=matched_key where user_id=auth.uid();
 return public.current_admin_access();
end $$;
revoke all on function public.open_admin_access_session(text) from public,anon;
grant execute on function public.open_admin_access_session(text) to authenticated;

-- Las operaciones que piden una segunda confirmación de propietario también
-- aceptan códigos personales con rol owner, conservando el límite de intentos.
do $migration$
declare definition text; old_clause text;
begin
 old_clause:='select exists(select 1 from app_private.admin_security where singleton=true and owner_code=p_code) into ok;';
 definition:=pg_get_functiondef('app_private.check_access_attempt(text,text,text,text)'::regprocedure);
 if position('/* named_owner_codes */' in definition)=0 then
  if position(old_clause in definition)=0 then raise exception 'OWNER_VERIFICATION_REVIEW_REQUIRED';end if;
  definition:=replace(definition,old_clause,
   '/* named_owner_codes */ select (exists(select 1 from app_private.admin_security where singleton=true and owner_code=p_code) or exists(select 1 from app_private.admin_access_codes where role=''owner'' and extensions.crypt(p_code,code_hash)=code_hash)) into ok;');
  execute definition;
 end if;
end $migration$;

-- Fotografía del nombre al hacer el movimiento, no al descargarlo.
create or replace function app_private.stamp_admin_movement_name()
returns trigger language plpgsql security definer set search_path='' as $$
declare s public.admin_access_sessions%rowtype;
begin
 select * into s from public.admin_access_sessions where user_id=auth.uid() and expires_at>now();
 if s.user_id is not null and new.performed_role=s.role then
  new.performed_name:=case when s.access_key='zoraida' then 'Zoraida'
   when s.role='owner' then 'Propietario' when s.role='logistics' then 'Logística'
   when s.role='supervisor' then 'Supervisión '||coalesce(s.zone,'') else null end;
 end if;
 return new;
end $$;
revoke all on function app_private.stamp_admin_movement_name() from public,anon,authenticated;
drop trigger if exists stamp_admin_movement_name on public.stock_movements;
create trigger stamp_admin_movement_name before insert on public.stock_movements
 for each row execute function app_private.stamp_admin_movement_name();

-- Guardas adicionales SIN ampliar los permisos ni modificar las operaciones
-- de consumo de las unidades. Fallo cerrado si no existen los RPC esperados.
do $guards$
declare spec record; oid regprocedure; definition text;
begin
 for spec in select * from (values
  ('public.correct_guard_consumption(uuid,text,text,integer,text)','owner,supervisor'),
  ('public.correct_tsnu_consumption(uuid,text,text,integer,integer,text)','owner,supervisor'),
  ('public.get_unit_inoperability_report(text,text,timestamp with time zone,timestamp with time zone,integer)','owner,supervisor,reports_viewer')
 ) as v(signature,roles) loop
  oid:=to_regprocedure(spec.signature);
  if oid is null then raise exception 'ADMIN_RPC_MISSING: %',spec.signature;end if;
  definition:=pg_get_functiondef(oid);
  if position('/* logistics_restricted_v1 */' in definition)=0 then
   if definition !~* '\mbegin\M' then raise exception 'ADMIN_RPC_REVIEW_REQUIRED: %',spec.signature;end if;
   definition:=regexp_replace(definition,'\mbegin\M',format(
    $guard$begin /* logistics_restricted_v1 */ if not public.admin_has_role(string_to_array(%L,',')) then raise exception 'ADMIN_ROLE_ACCESS_DENIED';end if;$guard$,spec.roles), 'i');
   execute definition;
  end if;
 end loop;
end $guards$;

create or replace function public.get_database_usage()
returns table(database_bytes bigint,database_mb numeric)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.admin_has_role(array['owner']) then raise exception 'ADMIN_ROLE_ACCESS_DENIED';end if;
 return query select pg_database_size(current_database())::bigint,
 round(pg_database_size(current_database())::numeric/1024/1024,2);
end $$;
revoke all on function public.get_database_usage() from public,anon;
grant execute on function public.get_database_usage() to authenticated;

-- Configuración desde sesión owner, o desde SQL Editor por postgres.
create or replace function public.configure_zoraida_access(p_code text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if session_user<>'postgres' and not public.admin_has_role(array['owner']) then raise exception 'OWNER_AUTHORIZATION_REQUIRED';end if;
 if p_code is null or p_code !~ '^[A-Za-z0-9]{6,13}$' then raise exception 'INVALID_ACCESS_CODE';end if;
 if exists(select 1 from app_private.admin_access_codes where access_key<>'zoraida' and extensions.crypt(p_code,code_hash)=code_hash)
 then raise exception 'DUPLICATED_ACCESS_CODE';end if;
 insert into app_private.admin_access_codes(access_key,role,zone,code_hash,updated_at)
 values('zoraida','owner',null,extensions.crypt(p_code,extensions.gen_salt('bf')),now())
 on conflict(access_key) do update set role=excluded.role,zone=null,code_hash=excluded.code_hash,updated_at=now();
 delete from public.admin_access_sessions where access_key='zoraida';
 return true;
end $$;
revoke all on function public.configure_zoraida_access(text) from public,anon;
grant execute on function public.configure_zoraida_access(text) to authenticated;
commit;

-- SEGUNDO PASO: ejecutar aparte, escribiendo un código NUEVO solo en el editor.
-- select public.configure_zoraida_access('ESCRIBE_AQUI_EL_CODIGO_NUEVO');
-- Comprobación sin mostrar códigos:
select access_key,role,zone from app_private.admin_access_codes where access_key='zoraida';
