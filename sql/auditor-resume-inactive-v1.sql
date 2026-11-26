-- Preserve all existing code/role/scope/rate-limit checks, and all pending data.
-- This installs a recovery path; it does NOT activate any device by itself.
begin;
do $migration$
declare definition text; anchor text; recovery text;
begin
 definition:=pg_get_functiondef(to_regprocedure('public.authorize_mobile_auditor(text,text,text,text,text,boolean)'));
 if definition is null then raise exception 'MISSING_AUDITOR_AUTHORIZATION'; end if;
 if position('AUDITOR_SAME_ASSIGNMENT_RECOVERY_V1' in definition)>0 then return; end if;
 anchor:='select * into old from public.auditor_devices where user_id=auth.uid() for update;';
 if position(anchor in definition)=0 or position('INVALID_AUDITOR_AUTHORIZATION' in definition)=0
 or position('INVALID_AUDITOR_AUTHORIZATION' in definition)>position(anchor in definition)
 or position('AUDITOR_PENDING_WORK' in definition)<position(anchor in definition) then
  raise exception 'UNEXPECTED_AUDITOR_AUTHORIZATION_DEFINITION';
 end if;
 recovery:=$branch$
 -- AUDITOR_SAME_ASSIGNMENT_RECOVERY_V1: code was validated above.
 if old.user_id is not null and not old.active and old.full_name=normalized
 and old.lot=p_lot and old.zone=p_zone and old.warehouse_id=p_warehouse_id then
  if exists(select 1 from public.auditor_audit_drafts d where d.user_id=auth.uid() and d.submitted_at is null
    and (d.profile_revision<>old.revision or d.full_name<>old.full_name or d.lot<>old.lot or d.zone<>old.zone or d.warehouse_id<>old.warehouse_id))
  or exists(select 1 from public.auditor_material_drafts d where d.user_id=auth.uid() and d.profile_revision<>old.revision
    and exists(select 1 from jsonb_each_text(d.materials)m where m.value::numeric>0)) then
   raise exception 'AUDITOR_RECOVERY_SCOPE_MISMATCH';
  end if;
  if exists(select 1 from public.device_authorizations where user_id=auth.uid() and active)
  or exists(select 1 from public.tsnu_shift_sessions where user_id=auth.uid() and ended_at is null) then
   raise exception 'AUDITOR_RECOVERY_OTHER_ROLE_ACTIVE';
  end if;
  update public.auditor_devices set active=true,authorized_role=code_row.role,updated_at=clock_timestamp() where user_id=auth.uid();
  delete from public.auditor_access_attempts where user_id=auth.uid();
  delete from public.admin_access_sessions where user_id=auth.uid();
  insert into public.auditor_access_history(user_id,actor_user_id,action,old_profile,new_profile)
  values(auth.uid(),auth.uid(),'reauthorize_preserving_work',to_jsonb(old),public.get_my_auditor_profile());
  return public.get_my_auditor_profile();
 end if;
 $branch$;
 execute replace(definition,anchor,anchor||recovery);
end $migration$;
commit;
select position('AUDITOR_SAME_ASSIGNMENT_RECOVERY_V1' in pg_get_functiondef(to_regprocedure('public.authorize_mobile_auditor(text,text,text,text,text,boolean)')))>0 as recovery_ready;
