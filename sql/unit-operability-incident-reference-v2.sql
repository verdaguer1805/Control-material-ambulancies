-- Additive. Preserve old clients/pending operations and original question meaning.
begin;
alter table public.unit_operability_incidents add column if not exists external_incident_id text;
alter table public.unit_operability_incidents add column if not exists question_version integer not null default 1;
create or replace function public.start_my_unit_inoperability_v2(
 p_expected_lot text,p_expected_unit text,p_id uuid,p_vehicle text,p_reason text,p_has_patient boolean,
 p_description text,p_justification text,p_started_at timestamptz,p_external_incident_id text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare ctx jsonb;existing public.unit_operability_incidents%rowtype;reference text;
begin
 ctx:=app_private.require_operability_unit(p_expected_lot,p_expected_unit);
 reference:=case when p_has_patient then nullif(trim(p_external_incident_id),'') else null end;
 if p_has_patient is null or (p_has_patient and reference is null) or length(reference)>100 or reference ~ '[[:cntrl:]]'
 then raise exception 'INCIDENT_ID_REQUIRED_OR_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_expected_lot||':'||p_expected_unit,0));
 select * into existing from public.unit_operability_incidents where id=p_id;
 if found and (existing.lot<>p_expected_lot or existing.unit<>p_expected_unit or existing.question_version<>2 or existing.external_incident_id is distinct from reference)
 then raise exception 'OPERABILITY_OPERATION_CONFLICT';end if;
 -- Existing function enforces scope, dates, registry identity and idempotence.
 perform public.start_my_unit_inoperability(p_expected_lot,p_expected_unit,p_id,p_vehicle,p_reason,p_has_patient,p_description,p_justification,p_started_at);
 update public.unit_operability_incidents set external_incident_id=reference,question_version=2 where id=p_id;
 return public.get_my_unit_operability(p_expected_lot,p_expected_unit);
end $$;
revoke all on function public.start_my_unit_inoperability_v2(text,text,uuid,text,text,boolean,text,text,timestamptz,text) from public,anon;
grant execute on function public.start_my_unit_inoperability_v2(text,text,uuid,text,text,boolean,text,text,timestamptz,text) to authenticated;
commit;
