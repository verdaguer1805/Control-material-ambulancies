-- Match the accepted length of existing admin codes. No code, role, stock,
-- session or attempt counter is changed. Hash, zone and rate-limit checks stay.
begin;
do $migration$
declare definition text;
begin
 select pg_get_functiondef('public.authorize_mobile_auditor(text,text,text,text,text,boolean)'::regprocedure) into definition;
 if position('length(p_code) between 6 and 64' in definition)>0 then
  execute replace(definition,'length(p_code) between 6 and 64','length(p_code) between 1 and 128');
 elsif position('length(p_code) between 1 and 128' in definition)=0 then
  raise exception 'Unexpected auditor authorization definition; no change applied';
 end if;
end $migration$;
commit;
