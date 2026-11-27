-- Auditor access lifecycle. Execute the whole file in SQL Editor.
-- Additive upgrade: no permission, assignment, audit, stock or date is rewritten.
-- Uses existing identity-per-mobile and existing owner/supervisor zone permissions.
begin;

-- Keep the last-authorization lookup bounded as the fleet/history grows.
create index if not exists auditor_access_history_grant_date
 on public.auditor_access_history(user_id,created_at desc)
 where action in ('authorize','reassign','reauthorize_preserving_work','enable');

-- Repeating a successful authorization of the same active profile is a safe retry,
-- not a new assignment. Validate the code/rate limit first; preserve pending work.
do $migration$
declare definition text; anchor text; retry_branch text;
begin
 definition:=pg_get_functiondef(to_regprocedure('public.authorize_mobile_auditor(text,text,text,text,text,boolean)'));
 if definition is null then raise exception 'MISSING_AUDITOR_AUTHORIZATION'; end if;
 if position('AUDITOR_ACTIVE_ASSIGNMENT_RETRY_V2' in definition)>0 then return; end if;
 anchor:='select * into old from public.auditor_devices where user_id=auth.uid() for update;';
 if position(anchor in definition)=0
 or position('AUDITOR_SAME_ASSIGNMENT_RECOVERY_V1' in definition)=0
 or position('INVALID_AUDITOR_AUTHORIZATION' in definition)=0
 or position('INVALID_AUDITOR_AUTHORIZATION' in definition)>position(anchor in definition)
 or position('AUDITOR_PENDING_WORK' in definition)<position(anchor in definition)
 then raise exception 'UNEXPECTED_AUDITOR_AUTHORIZATION_DEFINITION'; end if;
 retry_branch:=$branch$
 -- AUDITOR_ACTIVE_ASSIGNMENT_RETRY_V2: authorization code already validated.
 if old.user_id is not null and old.active and old.full_name=normalized
 and old.lot=p_lot and old.zone=p_zone and old.warehouse_id=p_warehouse_id then
  if exists(select 1 from public.device_authorizations where user_id=auth.uid() and active)
  or exists(select 1 from public.tsnu_shift_sessions where user_id=auth.uid() and ended_at is null) then
   raise exception 'AUDITOR_RECOVERY_OTHER_ROLE_ACTIVE';
  end if;
  delete from public.auditor_access_attempts where user_id=auth.uid();
  delete from public.admin_access_sessions where user_id=auth.uid();
  return public.get_my_auditor_profile();
 end if;
 $branch$;
 execute replace(definition,anchor,anchor||retry_branch);
end $migration$;

create or replace function public.list_mobile_auditors()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(public.admin_has_role(array['owner','supervisor']),false) then raise exception 'ADMIN_ROLE_ACCESS_DENIED'; end if;
 return coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object(
  'warehouse_name',w.name,
  'last_authorized_at',h.last_authorized_at,
  'pending_audits_count', (select count(*) from public.auditor_audit_drafts d where d.user_id=p.user_id and d.submitted_at is null),
  'pending_materials', exists(select 1 from public.auditor_material_drafts d cross join lateral jsonb_each_text(d.materials)m where d.user_id=p.user_id and m.value::numeric>0)
 ) order by p.zone,p.full_name,p.user_id)
 from public.auditor_devices p join public.warehouses w on w.id=p.warehouse_id
 left join lateral (
  select max(a.created_at) as last_authorized_at from public.auditor_access_history a
  where a.user_id=p.user_id and a.action in ('authorize','reassign','reauthorize_preserving_work','enable')
 )h on true
 where public.admin_can_access_zone(p.zone)),'[]'::jsonb);
end $$;

create or replace function public.revoke_mobile_auditor(p_user_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare old public.auditor_devices%rowtype; changed public.auditor_devices%rowtype;
begin
 if not coalesce(public.admin_has_role(array['owner','supervisor']),false) then raise exception 'ADMIN_ROLE_ACCESS_DENIED'; end if;
 select * into old from public.auditor_devices where user_id=p_user_id for update;
 if old.user_id is null or not coalesce(public.admin_can_access_zone(old.zone),false) then raise exception 'ADMIN_ZONE_ACCESS_DENIED'; end if;
 if not old.active then return true; end if;
 update public.auditor_devices set active=false,updated_at=clock_timestamp() where user_id=p_user_id returning * into changed;
 insert into public.auditor_access_history(user_id,actor_user_id,action,old_profile,new_profile)
 values(p_user_id,auth.uid(),'revoke',to_jsonb(old),to_jsonb(changed));
 return true;
end $$;

-- Admin confirmation is bound to the exact permission shown on screen.
create or replace function public.revoke_mobile_auditor_checked(p_user_id uuid,p_expected_revision integer,p_expected_updated_at timestamptz)
returns boolean language plpgsql security definer set search_path='' as $$
declare old public.auditor_devices%rowtype;
begin
 if not coalesce(public.admin_has_role(array['owner','supervisor']),false) then raise exception 'ADMIN_ROLE_ACCESS_DENIED'; end if;
 select * into old from public.auditor_devices where user_id=p_user_id for update;
 if old.user_id is null or not coalesce(public.admin_can_access_zone(old.zone),false) then raise exception 'ADMIN_ZONE_ACCESS_DENIED'; end if;
 if not old.active then return true; end if;
 if old.revision is distinct from p_expected_revision or old.updated_at is distinct from p_expected_updated_at then
  raise exception 'AUDITOR_ACCESS_CHANGED';
 end if;
 return public.revoke_mobile_auditor(p_user_id);
end $$;

create or replace function public.enable_mobile_auditor(p_user_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare old public.auditor_devices%rowtype; changed public.auditor_devices%rowtype;
begin
 if not coalesce(public.admin_has_role(array['owner','supervisor']),false) then raise exception 'ADMIN_ROLE_ACCESS_DENIED'; end if;
 select * into old from public.auditor_devices where user_id=p_user_id for update;
 if old.user_id is null or not coalesce(public.admin_can_access_zone(old.zone),false) then raise exception 'ADMIN_ZONE_ACCESS_DENIED'; end if;
 if not exists(select 1 from public.warehouses w where w.id=old.warehouse_id and w.lot=old.lot and w.zone=old.zone) then raise exception 'AUDITOR_WAREHOUSE_MISMATCH'; end if;
 if exists(select 1 from public.device_authorizations where user_id=p_user_id and active)
 or exists(select 1 from public.tsnu_shift_sessions where user_id=p_user_id and ended_at is null) then
  raise exception 'AUDITOR_RECOVERY_OTHER_ROLE_ACTIVE';
 end if;
 if exists(select 1 from public.auditor_audit_drafts d where d.user_id=p_user_id and d.submitted_at is null
  and (d.profile_revision<>old.revision or d.full_name<>old.full_name or d.lot<>old.lot or d.zone<>old.zone or d.warehouse_id<>old.warehouse_id))
 or exists(select 1 from public.auditor_material_drafts d where d.user_id=p_user_id and d.profile_revision<>old.revision
  and exists(select 1 from jsonb_each_text(d.materials)m where m.value::numeric>0)) then
  raise exception 'AUDITOR_RECOVERY_SCOPE_MISMATCH';
 end if;
 if old.active then return true; end if;
 update public.auditor_devices set active=true,updated_at=clock_timestamp() where user_id=p_user_id returning * into changed;
 insert into public.auditor_access_history(user_id,actor_user_id,action,old_profile,new_profile)
 values(p_user_id,auth.uid(),'enable',to_jsonb(old),to_jsonb(changed));
 return true;
end $$;

create or replace function public.leave_mobile_auditor()
returns boolean language plpgsql security definer set search_path='' as $$
declare old public.auditor_devices%rowtype; changed public.auditor_devices%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into old from public.auditor_devices where user_id=auth.uid() for update;
 if old.user_id is null then raise exception 'AUDITOR_PROFILE_NOT_FOUND'; end if;
 if exists(select 1 from public.auditor_audit_drafts where user_id=auth.uid() and submitted_at is null)
 or exists(select 1 from public.auditor_material_drafts d cross join lateral jsonb_each_text(d.materials)m where d.user_id=auth.uid() and m.value::numeric>0)
 then raise exception 'AUDITOR_PENDING_WORK'; end if;
 -- Check server-only pending work even when revoked: the caller clears its local
 -- profile only on success. Repeated completed exits remain safe after timeouts.
 if not old.active then return true; end if;
 update public.auditor_devices set active=false,updated_at=clock_timestamp() where user_id=auth.uid() returning * into changed;
 insert into public.auditor_access_history(user_id,actor_user_id,action,old_profile,new_profile)
 values(auth.uid(),auth.uid(),'leave',to_jsonb(old),to_jsonb(changed));
 return true;
end $$;

revoke all on function public.list_mobile_auditors() from public,anon;
revoke all on function public.revoke_mobile_auditor(uuid) from public,anon;
revoke all on function public.revoke_mobile_auditor_checked(uuid,integer,timestamptz) from public,anon;
revoke all on function public.enable_mobile_auditor(uuid) from public,anon;
revoke all on function public.leave_mobile_auditor() from public,anon;
grant execute on function public.list_mobile_auditors() to authenticated;
grant execute on function public.revoke_mobile_auditor(uuid) to authenticated;
grant execute on function public.revoke_mobile_auditor_checked(uuid,integer,timestamptz) to authenticated;
grant execute on function public.enable_mobile_auditor(uuid) to authenticated;
grant execute on function public.leave_mobile_auditor() to authenticated;
commit;

select position('AUDITOR_ACTIVE_ASSIGNMENT_RETRY_V2' in pg_get_functiondef(to_regprocedure('public.authorize_mobile_auditor(text,text,text,text,text,boolean)')))>0 as auditor_retry_ready,
 position('last_authorized_at' in pg_get_functiondef(to_regprocedure('public.list_mobile_auditors()')))>0 as auditor_dates_ready,
 position('''leave''' in pg_get_functiondef(to_regprocedure('public.leave_mobile_auditor()')))>0 as auditor_leave_trace_ready,
 to_regprocedure('public.revoke_mobile_auditor_checked(uuid,integer,timestamp with time zone)') is not null as auditor_checked_revoke_ready;
