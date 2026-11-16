-- TSNU Lot 5 expansion. Run BEFORE publishing the new selector.
-- No stock, consumption, historical checklist, phone permission or warehouse changes.
-- KE1384 moves to Girona; KE1388 stays in Olot.
begin;
create temporary table tsnu_import_20261116(zone text,unit text primary key,plate text unique) on commit drop;
insert into tsnu_import_20261116 values
('Figueres','K1368','3286NLL'),
('Figueres','K1369','6184NLJ'),
('Figueres','K1370','1030NMB'),
('Figueres','K1371','6186NLJ'),
('Figueres','K1372','6187NLJ'),
('Figueres','K1373','6173NLJ'),
('Figueres','KE1401','1215NLP'),
('Figueres','KE1402','1216NLP'),
('Figueres','T1716','9691NLH'),
('Figueres','T1717','9690NLH'),
('Figueres','T1718','9699NLH'),
('Figueres','T1719','9692NLH'),
('Figueres','T1720','9694NLH'),
('Figueres','T1721','9701NLH'),
('Figueres','T1722','9696NLH'),
('Figueres','T1723','9700NLH'),
('Figueres','T1724','9731NLH'),
('Figueres','T1725','9707NLH'),
('Figueres','T1726','9704NLH'),
('Figueres','T1727','9698NLH'),
('Figueres','T1728','9706NLH'),
('Figueres','T1729','9705NLH'),
('Figueres','T1730','9735NLH'),
('Girona','K1342','4671NLJ'),
('Girona','K1343','6200NLJ'),
('Girona','K1344','6172NLJ'),
('Girona','K1345','6179NLJ'),
('Girona','K1346','6183NLJ'),
('Girona','K1347','4678NLJ'),
('Girona','K1348','4665NLJ'),
('Girona','K1349','4677NLJ'),
('Girona','K1350','4675NLJ'),
('Girona','K1351','4698NLJ'),
('Girona','K1352','6180NLJ'),
('Girona','K1358','3294NLL'),
('Girona','K1359','3290NLL'),
('Girona','KB1404','5040NLF'),
('Girona','KB1405','4972NLF'),
('Girona','KE1378','1218NLP'),
('Girona','KE1379','1205NLP'),
('Girona','KE1380','1219NLP'),
('Girona','KE1381','1207NLP'),
('Girona','KE1382','1347NLP'),
('Girona','KE1383','1578NLP'),
('Girona','KE1384','1206NLP'),
('Girona','KE1385','1579NLP'),
('Girona','KE1386','1747NLP'),
('Girona','KE1387','1584NLP'),
('Girona','T1654','3496NLG'),
('Girona','T1655','4309NLG'),
('Girona','T1656','4374NLG'),
('Girona','T1657','4449NLG'),
('Girona','T1658','4990NLG'),
('Girona','T1659','5019NLG'),
('Girona','T1660','5042NLG'),
('Girona','T1661','5093NLG'),
('Girona','T1662','5202NLG'),
('Girona','T1663','5245NLG'),
('Girona','T1664','5293NLG'),
('Girona','T1665','5315NLG'),
('Girona','T1666','5350NLG'),
('Girona','T1667','5374NLG'),
('Girona','T1668','5429NLG'),
('Girona','T1669','5493NLG'),
('Girona','T1670','3022NLH'),
('Girona','T1671','3023NLH'),
('Girona','T1672','3028NLH'),
('Girona','T1673','3024NLH'),
('Girona','T1674','3020NLH'),
('Girona','T1675','3021NLH'),
('Girona','T1676','3025NLH'),
('Girona','T1677','3027NLH'),
('Girona','T1678','3030NLH'),
('Girona','VL051','1211NLP'),
('Blanes','K1353','6182NLJ'),
('Blanes','K1354','6193NLJ'),
('Blanes','K1355','6174NLJ'),
('Blanes','K1356','6181NLJ'),
('Blanes','K1357','6176NLJ'),
('Blanes','K1360','3355NLL'),
('Blanes','K1361','3278NLL'),
('Blanes','K1362','9116NLL'),
('Blanes','K1363','9117NLL'),
('Blanes','K1364','9121NLL'),
('Blanes','K1365','9111NLL'),
('Blanes','K1366','9118NLL'),
('Blanes','K1367','9124NLL'),
('Blanes','KB1406','4823NLF'),
('Blanes','KB1407','8546NLB'),
('Blanes','KE1389','1217NLP'),
('Blanes','KE1390','1208NLP'),
('Blanes','KE1391','1586NLP'),
('Blanes','KE1392','1577NLP'),
('Blanes','KE1393','1583NLP'),
('Blanes','KE1394','1261NLP'),
('Blanes','KE1395','1585NLP'),
('Blanes','KE1396','1212NLP'),
('Blanes','KE1397','1582NLP'),
('Blanes','KE1398','1724NLP'),
('Blanes','KE1399','1214NLP'),
('Blanes','KE1400','1210NLP'),
('Blanes','T1679','3019NLH'),
('Blanes','T1680','3026NLH'),
('Blanes','T1681','3049NLH'),
('Blanes','T1682','3031NLH'),
('Blanes','T1683','3029NLH'),
('Blanes','T1684','3018NLH'),
('Blanes','T1685','3758NLH'),
('Blanes','T1686','3757NLH'),
('Blanes','T1687','3759NLH'),
('Blanes','T1688','3760NLH'),
('Blanes','T1689','3761NLH'),
('Blanes','T1690','3762NLH'),
('Blanes','T1691','4293NLH'),
('Blanes','T1692','4294NLH'),
('Blanes','T1693','4295NLH'),
('Blanes','T1694','4297NLH'),
('Blanes','T1695','4302NLH'),
('Blanes','T1696','4299NLH'),
('Blanes','T1697','4300NLH'),
('Blanes','T1698','4287NLH'),
('Blanes','T1699','4288NLH'),
('Blanes','T1700','4289NLH'),
('Blanes','T1701','4290NLH'),
('Blanes','T1702','4291NLH'),
('Blanes','T1703','4292NLH'),
('Blanes','T1704','4298NLH'),
('Blanes','T1705','4296NLH'),
('Blanes','T1706','9733NLH'),
('Blanes','T1707','9683NLH'),
('Blanes','T1708','9732NLH'),
('Blanes','T1709','9684NLH'),
('Blanes','T1710','9741NLH'),
('Blanes','T1711','9685NLH'),
('Blanes','T1712','9687NLH'),
('Blanes','T1713','9686NLH'),
('Blanes','T1714','9689NLH'),
('Blanes','T1715','9688NLH'),
('Olot','KE1388','1581NLP');

do $$ begin
 if (select count(*) from tsnu_import_20261116)<>139 then raise exception 'INVALID_IMPORT_COUNT'; end if;
 if exists(select 1 from public.fleet_vehicle_registry f join tsnu_import_20261116 i
   on f.lot='Lot 5 · Girona - Alt Maresme' and (f.vehicle=i.unit or f.plate=i.plate)
   where f.vehicle<>i.unit or f.plate<>i.plate) then
   raise exception 'EXISTING_VEHICLE_PLATE_CONFLICT: review before importing';
 end if;
end $$;

insert into public.tsnu_units(lot,zone,unit,active)
select 'Lot 5 · Girona - Alt Maresme',zone,unit,true from tsnu_import_20261116
on conflict(lot,zone,unit) do update set active=true;
-- Retain the old row for existing foreign keys and history. New assignment must
-- be explicitly confirmed in Girona with its correct warehouse, never guessed.
update public.tsnu_units set active=false
where lot='Lot 5 · Girona - Alt Maresme' and zone='Olot' and unit='KE1384';

insert into public.fleet_vehicle_registry(lot,vehicle,plate,reference_zone,reference_unit,vehicle_type)
select 'Lot 5 · Girona - Alt Maresme',unit,plate,zone,unit,'TSNU' from tsnu_import_20261116
on conflict(lot,vehicle) do update set reference_zone=excluded.reference_zone,
 reference_unit=excluded.reference_unit,vehicle_type=excluded.vehicle_type;

-- Existing submit validation uses template families K/KE (without tools) and T.
-- Map the new independent UI families explicitly to those compatible rules.
create or replace function public.tsnu_checklist_family(p_unit text)
returns text language sql immutable set search_path='' as $$
 select case
 when upper(btrim(coalesce(p_unit,''))) like 'KB%' then 'KE'
 when upper(btrim(coalesce(p_unit,''))) like 'KE%' then 'KE'
 when upper(btrim(coalesce(p_unit,''))) like 'K%' then 'K'
 when upper(btrim(coalesce(p_unit,''))) like 'VL%' then 'T'
 else 'T' end
$$;
revoke all on function public.tsnu_checklist_family(text) from public,anon,authenticated;
commit;

select zone,count(*) as unidades_activas from public.tsnu_units
where lot='Lot 5 · Girona - Alt Maresme' and active group by zone order by zone;
select unit,zone,active from public.tsnu_units
where lot='Lot 5 · Girona - Alt Maresme' and unit in ('KE1384','KE1388') order by unit,zone;

