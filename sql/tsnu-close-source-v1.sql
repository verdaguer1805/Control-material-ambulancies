-- Registra si una guardia TSNU se cerró manualmente o automáticamente.
-- Compatible con clientes anteriores: el RPC antiguo sigue marcando manual.
begin;

alter table public.tsnu_shift_sessions
  add column if not exists close_source text;

update public.tsnu_shift_sessions
set close_source = 'manual'
where ended_at is not null and close_source is null;

alter table public.tsnu_shift_sessions
  drop constraint if exists tsnu_shift_sessions_close_source_check;
alter table public.tsnu_shift_sessions
  add constraint tsnu_shift_sessions_close_source_check
  check (close_source is null or close_source in ('manual','automatic','recovery'));

create or replace function public.finish_tsnu_shift(p_shift_id uuid,p_ended_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_shift public.tsnu_shift_sessions%rowtype;
begin
 select * into v_shift from public.tsnu_shift_sessions where id=p_shift_id for update;
 if not found or v_shift.user_id<>auth.uid() then raise exception 'INVALID_SHIFT'; end if;
 if v_shift.checklist_submitted_at is null then raise exception 'CHECKLIST_REQUIRED'; end if;
 if v_shift.ended_at is not null then return to_jsonb(v_shift); end if;
 if p_ended_at is null or p_ended_at<v_shift.started_at then raise exception 'INVALID_END_TIME'; end if;
 update public.tsnu_shift_sessions set ended_at=p_ended_at,close_source='manual'
 where id=p_shift_id returning * into v_shift;
 return to_jsonb(v_shift);
end $$;

create or replace function public.finish_tsnu_shift_v2(
 p_shift_id uuid,p_ended_at timestamptz,p_close_source text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_shift public.tsnu_shift_sessions%rowtype;
begin
 if p_close_source not in ('manual','automatic') then raise exception 'INVALID_CLOSE_SOURCE'; end if;
 select * into v_shift from public.tsnu_shift_sessions where id=p_shift_id for update;
 if not found or v_shift.user_id<>auth.uid() then raise exception 'INVALID_SHIFT'; end if;
 if v_shift.checklist_submitted_at is null then raise exception 'CHECKLIST_REQUIRED'; end if;
 if v_shift.ended_at is not null then return to_jsonb(v_shift); end if;
 if p_ended_at is null or p_ended_at<v_shift.started_at then raise exception 'INVALID_END_TIME'; end if;
 update public.tsnu_shift_sessions set ended_at=p_ended_at,close_source=p_close_source
 where id=p_shift_id returning * into v_shift;
 return to_jsonb(v_shift);
end $$;

revoke all on function public.finish_tsnu_shift(uuid,timestamptz) from public,anon;
grant execute on function public.finish_tsnu_shift(uuid,timestamptz) to authenticated;
revoke all on function public.finish_tsnu_shift_v2(uuid,timestamptz,text) from public,anon;
grant execute on function public.finish_tsnu_shift_v2(uuid,timestamptz,text) to authenticated;

-- La lista TSNU ya no exige «Sabanas de un solo uso». Las respuestas antiguas
-- que aún contienen el campo siguen siendo aceptadas para no romper pendientes.
create or replace function public.submit_tsnu_checklist(p_shift_id uuid,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_shift public.tsnu_shift_sessions%rowtype;v_required text[]:=array[
 'Maleta de intervención precintada','DEA','Mantas de un solo uso',
 'Contenedor de agujas grande','Bolsas de vómito','Sonda de aspiración','Aspirador manual','Empapadores',
 'Cuña de hombre','Cuña de mujer','Bata EPI o mono de protección','Bolsas de residuos GII','Bolsas de basura negras',
 'Gafas de protección EPI','Guantes de protección EPI','Oxígeno disponible y con carga suficiente',
 'Guantes de nitrilo de diferentes tallas','Cadenas de nieve','Cizallas','Pata de cabra','Tarjeta de gasóleo','Tarjeta Trueta','Baliza V-16'];
begin
 select * into v_shift from public.tsnu_shift_sessions where id=p_shift_id for update;
 if not found or v_shift.user_id<>auth.uid() or v_shift.ended_at is not null then raise exception 'INVALID_OPEN_SHIFT'; end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'object'
 or exists(select 1 from unnest(v_required) x where p_answers->>x not in ('ok','issue'))
 or exists(select 1 from jsonb_object_keys(p_answers) x where not (x=any(v_required) or x='Sabanas de un solo uso'))
 or (p_answers ? 'Sabanas de un solo uso' and p_answers->>'Sabanas de un solo uso' not in ('ok','issue'))
 then raise exception 'INCOMPLETE_CHECKLIST'; end if;
 if v_shift.checklist_answers is not null and v_shift.checklist_answers<>p_answers then raise exception 'CHECKLIST_ALREADY_SUBMITTED'; end if;
 update public.tsnu_shift_sessions set checklist_answers=p_answers,
  checklist_submitted_at=coalesce(checklist_submitted_at,now()) where id=p_shift_id returning * into v_shift;
 return to_jsonb(v_shift);
end $$;
revoke all on function public.submit_tsnu_checklist(uuid,jsonb) from public,anon;
grant execute on function public.submit_tsnu_checklist(uuid,jsonb) to authenticated;

create or replace function public.get_tsnu_report_data(
  p_lot text,p_zone text,p_from date,p_to date
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_from timestamptz;v_until timestamptz;
begin
 if auth.uid() is null or not public.admin_can_access_zone(p_zone) then raise exception 'ADMIN_ZONE_ACCESS_DENIED'; end if;
 if p_lot is null or p_zone is null or p_from is null or p_to is null or p_from>p_to then raise exception 'INVALID_REPORT_RANGE'; end if;
 v_from:=p_from::timestamp at time zone 'Europe/Madrid';
 v_until:=(p_to+1)::timestamp at time zone 'Europe/Madrid';
 return jsonb_build_object(
  'shifts',coalesce((select jsonb_agg(jsonb_build_object(
   'id',s.id,'lot',s.lot,'zone',s.zone,'unit',s.unit,'warehouse_id',s.warehouse_id,
   'warehouse',w.name,'checklist_version',s.checklist_version,'started_at',s.started_at,
   'checklist_answers',s.checklist_answers,'checklist_submitted_at',s.checklist_submitted_at,
   'ended_at',s.ended_at,'close_source',s.close_source
  ) order by s.started_at)
  from public.tsnu_shift_sessions s join public.warehouses w on w.id=s.warehouse_id
  where s.lot=p_lot and s.zone=p_zone and s.started_at>=v_from and s.started_at<v_until),'[]'::jsonb),
  'withdrawals',coalesce((select jsonb_agg(jsonb_build_object(
   'operation_id',x.operation_id,'shift_id',x.shift_id,'unit',s.unit,
   'warehouse',w.name,'materials',x.materials,'created_at',x.created_at
  ) order by x.created_at)
  from public.tsnu_withdrawals x join public.tsnu_shift_sessions s on s.id=x.shift_id
  join public.warehouses w on w.id=s.warehouse_id
  where s.lot=p_lot and s.zone=p_zone and s.started_at>=v_from and s.started_at<v_until),'[]'::jsonb)
 );
end $$;
revoke all on function public.get_tsnu_report_data(text,text,date,date) from public,anon;
grant execute on function public.get_tsnu_report_data(text,text,date,date) to authenticated;

commit;
