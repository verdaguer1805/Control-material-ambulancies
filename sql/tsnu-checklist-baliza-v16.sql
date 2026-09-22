-- Apply before deploying the client with Baliza V-16. Old queued checklists
-- without this field remain valid; new clients require it in their UI.
create or replace function public.submit_tsnu_checklist(p_shift_id uuid,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_shift public.tsnu_shift_sessions%rowtype;v_required text[]:=array[
 'Maleta de intervención precintada','DEA','Mantas de un solo uso','Sabanas de un solo uso',
 'Contenedor de agujas grande','Bolsas de vómito','Sonda de aspiración','Aspirador manual','Empapadores',
 'Cuña de hombre','Cuña de mujer','Bata EPI o mono de protección','Bolsas de residuos GII','Bolsas de basura negras',
 'Gafas de protección EPI','Guantes de protección EPI','Oxígeno disponible y con carga suficiente',
 'Guantes de nitrilo de diferentes tallas','Cadenas de nieve','Cizallas','Pata de cabra','Tarjeta de gasóleo','Tarjeta Trueta'];
begin
 select * into v_shift from public.tsnu_shift_sessions where id=p_shift_id for update;
 if not found or v_shift.user_id<>auth.uid() or v_shift.ended_at is not null then raise exception 'INVALID_OPEN_SHIFT'; end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'object'
 or exists(select 1 from unnest(v_required) x where p_answers->>x not in ('ok','issue'))
 or exists(select 1 from jsonb_object_keys(p_answers) x where not (x=any(v_required) or x='Baliza V-16'))
 or (p_answers ? 'Baliza V-16' and p_answers->>'Baliza V-16' not in ('ok','issue'))
 then raise exception 'INCOMPLETE_CHECKLIST'; end if;
 if v_shift.checklist_answers is not null and v_shift.checklist_answers<>p_answers then raise exception 'CHECKLIST_ALREADY_SUBMITTED'; end if;
 update public.tsnu_shift_sessions set checklist_answers=p_answers,
  checklist_submitted_at=coalesce(checklist_submitted_at,now()) where id=p_shift_id returning * into v_shift;
 return to_jsonb(v_shift);
end $$;
revoke all on function public.submit_tsnu_checklist(uuid,jsonb) from public,anon;
grant execute on function public.submit_tsnu_checklist(uuid,jsonb) to authenticated;
