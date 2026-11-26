-- Add T1651 to the available TSNU units. Warehouse is selected during setup.
-- No historical checklists, assignments or vehicle registrations are changed.
begin;
do $add_unit$
begin
 if exists(select 1 from public.tsnu_units where lot='Lot 5 · Girona - Alt Maresme' and unit='T1651' and zone<>'Olot' and active)
 or exists(select 1 from public.tsnu_unit_assignments where lot='Lot 5 · Girona - Alt Maresme' and unit='T1651' and zone<>'Olot') then
  raise exception 'T1651_ASSIGNED_TO_ANOTHER_ZONE';
 end if;
 insert into public.tsnu_units(lot,zone,unit,active)
 values('Lot 5 · Girona - Alt Maresme','Olot','T1651',true)
 on conflict(lot,zone,unit) do update set active=true;
end $add_unit$;
commit;
select lot,zone,unit,active from public.tsnu_units
where lot='Lot 5 · Girona - Alt Maresme' and zone='Olot' and unit='T1651';
