-- Retire ONLY T1741, Lot 5 / Olot. Keep assignments and ALL historical rows.
begin;
do $retire$
begin
 if not exists(select 1 from public.tsnu_units where lot='Lot 5 · Girona - Alt Maresme' and zone='Olot' and unit='T1741') then
  raise exception 'T1741_OLOT_NOT_FOUND';
 end if;
 if exists(select 1 from public.tsnu_unit_assignments where lot='Lot 5 · Girona - Alt Maresme' and unit='T1741' and zone<>'Olot') then
  raise exception 'T1741_ASSIGNED_TO_ANOTHER_ZONE';
 end if;
 update public.tsnu_units set active=false
 where lot='Lot 5 · Girona - Alt Maresme' and zone='Olot' and unit='T1741';
 -- Authorization has no zone column: require the exact existing Olot assignment.
 update public.device_authorizations d set active=false
 where d.lot='Lot 5 · Girona - Alt Maresme' and d.unit='T1741' and d.active
 and exists(select 1 from public.tsnu_unit_assignments a where a.lot=d.lot and a.unit=d.unit and a.zone='Olot');
end $retire$;
commit;
select lot,zone,unit,active from public.tsnu_units
where lot='Lot 5 · Girona - Alt Maresme' and zone='Olot' and unit='T1741';
