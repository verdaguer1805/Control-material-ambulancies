-- Apply after tsnu-checklist-families-v1.sql and BEFORE publishing the new client.
-- No bulk updates, inventory changes or device reassignment.
-- Older/offline clients retain their original payload and confirmed history.
begin;
create or replace function public.submit_tsnu_checklist(p_shift_id uuid,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_shift public.tsnu_shift_sessions%rowtype;
 v_family text;
 v_new text[]:=array['Cargador de teléfono','Carpeta con documentación','Linterna + cono'];
 v_current boolean;
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
 if v_shift.checklist_answers is not null then
   if v_shift.checklist_answers<>p_answers then raise exception 'CHECKLIST_ALREADY_SUBMITTED'; end if;
   return to_jsonb(v_shift);
 end if;
 if v_shift.ended_at is not null then raise exception 'INVALID_OPEN_SHIFT'; end if;
 v_family:=public.tsnu_checklist_family(v_shift.unit);
 v_allowed:=v_required || array['Sabanas de un solo uso'] || v_new;
 if v_family in ('K','KE') then
   v_required:=array_remove(array_remove(v_required,'Cizallas'),'Pata de cabra');
 end if;
 -- A current checklist must include ALL new equipment, not a partial update.
 v_current:=p_answers ?| v_new;
 if v_current then
   v_required:=v_required || v_new;
 elsif not (p_answers ? 'Baliza V-16') then
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
       when v_current then 'tsnu-' || lower(v_family) || '-v3'
       when not (p_answers ? 'Baliza V-16') or p_answers ? 'Sabanas de un solo uso'
         or (v_family in ('K','KE') and (p_answers ? 'Cizallas' or p_answers ? 'Pata de cabra'))
         then checklist_version
       else 'tsnu-' || lower(v_family) || '-v2'
     end
 where id=p_shift_id returning * into v_shift;
 return to_jsonb(v_shift);
end $$;
revoke all on function public.submit_tsnu_checklist(uuid,jsonb) from public,anon;
grant execute on function public.submit_tsnu_checklist(uuid,jsonb) to authenticated;
commit;
