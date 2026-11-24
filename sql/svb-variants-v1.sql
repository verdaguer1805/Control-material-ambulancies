-- Only extend allowed audit types. No updates/deletes to checklists, drafts,
-- device permissions, assignments, answers, stock or historical records.
begin;
do $$
declare signature text; definition text; changed text; c record;
begin
 foreach signature in array array[
  'public.submit_vehicle_audit(uuid,text,text,jsonb)',
  'public.begin_mobile_auditor_audit(uuid,integer,text,text,jsonb)'
 ] loop
  definition:=pg_get_functiondef(to_regprocedure(signature));
  if definition is null then raise exception 'MISSING_REQUIRED_FUNCTION: %',signature; end if;
  if position('''SVB 4x4''' in definition)>0 then continue; end if;
  changed:=replace(definition,'''TSNU'',''SVB'',''Polivalente''','''TSNU'',''SVB'',''SVB 4x4'',''Polivalente''');
  if changed=definition then raise exception 'UNEXPECTED_SVB_FUNCTION_DEFINITION: %',signature; end if;
  execute changed;
 end loop;
 for c in select conname,pg_get_constraintdef(oid) as definition from pg_constraint
 where conrelid='public.supervisor_vehicle_audits'::regclass and contype='c'
 and pg_get_constraintdef(oid) like '%checklist_type%'
 loop
  if position('Polivalente' in c.definition)=0 then raise exception 'UNEXPECTED_AUDIT_CONSTRAINT'; end if;
  execute format('alter table public.supervisor_vehicle_audits drop constraint %I',c.conname);
 end loop;
 alter table public.supervisor_vehicle_audits add constraint supervisor_vehicle_audits_checklist_type_check
 check(checklist_type in ('TSNU','SVB','SVB 4x4','Polivalente'));
end $$;
commit;
select position('''SVB 4x4''' in pg_get_functiondef(to_regprocedure('public.submit_vehicle_audit(uuid,text,text,jsonb)')))>0 as supervisor_4x4_ready,
 position('''SVB 4x4''' in pg_get_functiondef(to_regprocedure('public.begin_mobile_auditor_audit(uuid,integer,text,text,jsonb)')))>0 as auditor_4x4_ready;
