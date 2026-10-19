-- Apply BEFORE deploying the T / K / KE client.
-- Global prefix rule; no roster, authorization, stock or historical-row updates.
-- Old mobile versions may still submit tools on K/KE; retain those real answers.
begin;

create or replace function public.tsnu_checklist_family(p_unit text)
returns text language sql immutable set search_path='' as $$
 select case
   when upper(btrim(coalesce(p_unit,''))) like 'KE%' then 'KE'
   when upper(btrim(coalesce(p_unit,''))) like 'K%' then 'K'
   when upper(btrim(coalesce(p_unit,''))) like 'T%' then 'T'
   else 'T' -- Preserve the previous checklist for unknown legacy prefixes.
 end
$$;
revoke all on function public.tsnu_checklist_family(text) from public,anon,authenticated;

create or replace function public.submit_tsnu_checklist(p_shift_id uuid,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_shift public.tsnu_shift_sessions%rowtype;
 v_family text;
 v_required text[]:=array[
  'Maleta de intervención precintada','DEA','Mantas de un solo uso',
  'Contenedor de agujas grande','Bolsas de vómito','Sonda de aspiración','Aspirador manual','Empapadores',
  'Cuña de hombre','Cuña de mujer','Bata EPI o mono de protección','Bolsas de residuos GII','Bolsas de basura negras',
  'Gafas de protección EPI','Guantes de protección EPI','Oxígeno disponible y con carga suficiente',
  'Guantes de nitrilo de diferentes tallas','Cadenas de nieve','Cizallas','Pata de cabra','Tarjeta de gasóleo','Tarjeta Trueta','Baliza V-16'];
 v_allowed text[];
begin
 select * into v_shift from public.tsnu_shift_sessions where id=p_shift_id for update;
 if not found or auth.uid() is null or v_shift.user_id is distinct from auth.uid()
 then raise exception 'INVALID_OPEN_SHIFT'; end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'object'
 then raise exception 'INCOMPLETE_CHECKLIST'; end if;
 -- A retry cannot rewrite an already submitted checklist, even after an update.
 if v_shift.checklist_answers is not null then
   if v_shift.checklist_answers<>p_answers then raise exception 'CHECKLIST_ALREADY_SUBMITTED'; end if;
   return to_jsonb(v_shift);
 end if;
 if v_shift.ended_at is not null then raise exception 'INVALID_OPEN_SHIFT'; end if;
 v_family:=public.tsnu_checklist_family(v_shift.unit);
 -- Allow old queued payloads, but never invent answers to excluded equipment.
 v_allowed:=v_required || array['Sabanas de un solo uso'];
 if v_family in ('K','KE') then
   v_required:=array_remove(array_remove(v_required,'Cizallas'),'Pata de cabra');
 end if;
 -- Older offline queues predate V-16. New clients still require it locally.
 if not (p_answers ? 'Baliza V-16') then
   v_required:=array_remove(v_required,'Baliza V-16');
 end if;
 if exists(select 1 from unnest(v_required) x where coalesce(p_answers->>x,'') not in ('ok','issue'))
 or exists(select 1 from jsonb_object_keys(p_answers) x where not (x=any(v_allowed)))
 or exists(select 1 from jsonb_each(p_answers) a where coalesce(a.value#>>'{}','') not in ('ok','issue'))
 then raise exception 'INCOMPLETE_CHECKLIST'; end if;
 update public.tsnu_shift_sessions
 set checklist_answers=p_answers,
     checklist_submitted_at=coalesce(checklist_submitted_at,now()),
     checklist_version=case
       when not (p_answers ? 'Baliza V-16') or p_answers ? 'Sabanas de un solo uso'
         or (v_family in ('K','KE') and (p_answers ? 'Cizallas' or p_answers ? 'Pata de cabra'))
         then checklist_version -- An older client submitted its original full list.
       else 'tsnu-' || lower(v_family) || '-v2'
     end
 where id=p_shift_id returning * into v_shift;
 return to_jsonb(v_shift);
end $$;
revoke all on function public.submit_tsnu_checklist(uuid,jsonb) from public,anon;
grant execute on function public.submit_tsnu_checklist(uuid,jsonb) to authenticated;

-- Read-only assertions: fail and roll back if prefix precedence is wrong.
do $$ begin
 if public.tsnu_checklist_family('T9001')<>'T'
 or public.tsnu_checklist_family('K9001')<>'K'
 or public.tsnu_checklist_family('KE9001')<>'KE'
 or public.tsnu_checklist_family(' ke9001 ')<>'KE'
 then raise exception 'TSNU_FAMILY_ASSERTION_FAILED'; end if;
end $$;
commit;
