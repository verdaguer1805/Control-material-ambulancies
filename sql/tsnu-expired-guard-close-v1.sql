-- TSNU: expired calendar-day guards never block the next shift.
-- No answers, submission timestamps, withdrawals or stock are fabricated.
begin;

create or replace function public.finish_tsnu_shift_v2(
 p_shift_id uuid,p_ended_at timestamptz,p_close_source text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_shift public.tsnu_shift_sessions%rowtype;v_end timestamptz;v_boundary timestamptz;
begin
 if p_close_source is null or p_close_source not in ('manual','automatic') then raise exception 'INVALID_CLOSE_SOURCE'; end if;
 select * into v_shift from public.tsnu_shift_sessions where id=p_shift_id for update;
 if not found or v_shift.user_id is distinct from auth.uid() then raise exception 'INVALID_SHIFT'; end if;
 -- Retries of an already closed, incomplete guard must succeed too.
 if v_shift.ended_at is not null then return to_jsonb(v_shift); end if;
 if p_ended_at is null or p_ended_at<v_shift.started_at or p_ended_at>now()+interval '5 minutes' then raise exception 'INVALID_END_TIME'; end if;
 v_end:=p_ended_at;
 if p_close_source='automatic' then
   v_boundary:=(((v_shift.started_at at time zone 'Europe/Madrid')::date+1)::timestamp at time zone 'Europe/Madrid');
   if now()<v_boundary or p_ended_at<v_boundary then raise exception 'INVALID_END_TIME'; end if;
   v_end:=v_boundary;
 elsif v_shift.checklist_submitted_at is null then
   raise exception 'CHECKLIST_REQUIRED';
 end if;
 update public.tsnu_shift_sessions set ended_at=v_end,close_source=p_close_source
 where id=p_shift_id returning * into v_shift;
 return to_jsonb(v_shift);
end $$;

create or replace function public.start_tsnu_shift(p_shift_id uuid,p_started_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_lot text;v_unit text;v_assignment public.tsnu_unit_assignments%rowtype;v_existing public.tsnu_shift_sessions%rowtype;
begin
 if p_shift_id is null or p_started_at is null or p_started_at>now()+interval '5 minutes' then raise exception 'INVALID_SHIFT'; end if;
 select lot,unit into v_lot,v_unit from public.device_authorizations d join public.app_security_config c on c.singleton=true
 where d.user_id=v_user and d.active and d.authorization_version=c.authorization_version;
 perform public.require_current_tsnu_device(v_lot,v_unit);
 select * into strict v_assignment from public.tsnu_unit_assignments where lot=v_lot and unit=v_unit;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text,51));
 select * into v_existing from public.tsnu_shift_sessions where id=p_shift_id;
 if found then
   if v_existing.user_id is distinct from v_user then raise exception 'SHIFT_ID_CONFLICT'; end if;
   return to_jsonb(v_existing);
 end if;
 -- A missing local finish operation (old app, offline, terminated browser)
 -- cannot strand a prior day's server session. Scope stays on this device,
 -- lot and unit; a same-day open shift still requires its normal closure.
 update public.tsnu_shift_sessions s
 set ended_at=(((s.started_at at time zone 'Europe/Madrid')::date+1)::timestamp at time zone 'Europe/Madrid'),close_source='automatic'
 where s.user_id=v_user and s.lot=v_lot and s.unit=v_unit and s.ended_at is null
 and (s.started_at at time zone 'Europe/Madrid')::date<(p_started_at at time zone 'Europe/Madrid')::date
 and (s.started_at at time zone 'Europe/Madrid')::date<(now() at time zone 'Europe/Madrid')::date;
 if exists(select 1 from public.tsnu_shift_sessions where user_id=v_user and ended_at is null)
 then raise exception 'OPEN_SHIFT_EXISTS'; end if;
 insert into public.tsnu_shift_sessions(id,user_id,lot,zone,unit,warehouse_id,checklist_version,started_at)
 values(p_shift_id,v_user,v_assignment.lot,v_assignment.zone,v_assignment.unit,v_assignment.warehouse_id,v_assignment.checklist_version,p_started_at)
 returning * into v_existing;
 return to_jsonb(v_existing);
end $$;

revoke all on function public.finish_tsnu_shift_v2(uuid,timestamptz,text) from public,anon;
grant execute on function public.finish_tsnu_shift_v2(uuid,timestamptz,text) to authenticated;
revoke all on function public.start_tsnu_shift(uuid,timestamptz) from public,anon;
grant execute on function public.start_tsnu_shift(uuid,timestamptz) to authenticated;
commit;
