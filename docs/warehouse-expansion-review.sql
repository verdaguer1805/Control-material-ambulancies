-- PREPARED FOR REVIEW ONLY. Not executed by the app.
-- Execute first against an isolated copy of production; activation requires review.
begin;
select pg_advisory_xact_lock(hashtextextended('lot5-warehouse-expansion-v1',0));
create temporary table expansion_warehouses(id text primary key, lot text, zone text, name text, kind text, unit_count integer) on commit drop;
insert into expansion_warehouses values
('lot5_figueres_central','Lot 5 · Girona - Alt Maresme','Figueres','Figueres','central',5),
('lot5_figueres_cadaques','Lot 5 · Girona - Alt Maresme','Figueres','Cadaqués','subwarehouse',1),
('lot5_figueres_castello_d_empuries','Lot 5 · Girona - Alt Maresme','Figueres','Castelló d''Empúries','subwarehouse',2),
('lot5_figueres_l_escala','Lot 5 · Girona - Alt Maresme','Figueres','L''Escala','subwarehouse',2),
('lot5_figueres_la_bisbal_d_emporda','Lot 5 · Girona - Alt Maresme','Figueres','La Bisbal d''Empordà','subwarehouse',2),
('lot5_figueres_la_jonquera','Lot 5 · Girona - Alt Maresme','Figueres','La Jonquera','subwarehouse',1),
('lot5_figueres_llanca','Lot 5 · Girona - Alt Maresme','Figueres','Llançà','subwarehouse',1),
('lot5_figueres_portbou','Lot 5 · Girona - Alt Maresme','Figueres','Portbou','subwarehouse',1),
('lot5_figueres_roses','Lot 5 · Girona - Alt Maresme','Figueres','Roses','subwarehouse',1),
('lot5_figueres_torroella_de_montgri_estartit','Lot 5 · Girona - Alt Maresme','Figueres','Torroella de Montgrí/Estartit','subwarehouse',2),
('lot5_girona_central','Lot 5 · Girona - Alt Maresme','Girona','Girona','central',7),
('lot5_girona_angles','Lot 5 · Girona - Alt Maresme','Girona','Anglès','subwarehouse',1),
('lot5_girona_cassa_de_la_selva','Lot 5 · Girona - Alt Maresme','Girona','Cassà de la Selva','subwarehouse',1),
('lot5_girona_castell_d_aro','Lot 5 · Girona - Alt Maresme','Girona','Castell d''Aro','subwarehouse',1),
('lot5_girona_llagostera','Lot 5 · Girona - Alt Maresme','Girona','Llagostera','subwarehouse',1),
('lot5_girona_palafrugell','Lot 5 · Girona - Alt Maresme','Girona','Palafrugell','subwarehouse',2),
('lot5_girona_palamos','Lot 5 · Girona - Alt Maresme','Girona','Palamós','subwarehouse',3),
('lot5_girona_salt','Lot 5 · Girona - Alt Maresme','Girona','Salt','subwarehouse',3),
('lot5_girona_sant_feliu_de_guixols','Lot 5 · Girona - Alt Maresme','Girona','Sant Feliu de Guíxols','subwarehouse',1),
('lot5_girona_sant_hilari_de_sacalm','Lot 5 · Girona - Alt Maresme','Girona','Sant Hilari de Sacalm','subwarehouse',1),
('lot5_girona_santa_coloma_de_farners','Lot 5 · Girona - Alt Maresme','Girona','Santa Coloma de Farners','subwarehouse',2),
('lot5_blanes_central','Lot 5 · Girona - Alt Maresme','Blanes','Blanes','central',6),
('lot5_blanes_calella','Lot 5 · Girona - Alt Maresme','Blanes','Calella','subwarehouse',3),
('lot5_blanes_canet_de_mar','Lot 5 · Girona - Alt Maresme','Blanes','Canet de Mar','subwarehouse',1),
('lot5_blanes_hostalric','Lot 5 · Girona - Alt Maresme','Blanes','Hostalric','subwarehouse',1),
('lot5_blanes_lloret_de_mar','Lot 5 · Girona - Alt Maresme','Blanes','Lloret de Mar','subwarehouse',4),
('lot5_blanes_macanet_de_la_selva','Lot 5 · Girona - Alt Maresme','Blanes','Maçanet de la Selva','subwarehouse',1),
('lot5_blanes_malgrat_de_mar','Lot 5 · Girona - Alt Maresme','Blanes','Malgrat de Mar','subwarehouse',1),
('lot5_blanes_pineda_de_mar','Lot 5 · Girona - Alt Maresme','Blanes','Pineda de Mar','subwarehouse',3),
('lot5_blanes_tordera','Lot 5 · Girona - Alt Maresme','Blanes','Tordera','subwarehouse',1),
('lot5_blanes_tossa_de_mar','Lot 5 · Girona - Alt Maresme','Blanes','Tossa de Mar','subwarehouse',1);
create temporary table expansion_assignments(unit text primary key, warehouse_id text) on commit drop;
insert into expansion_assignments values
('SL51','lot5_figueres_central'),
('G216','lot5_figueres_castello_d_empuries'),
('G206','lot5_figueres_central'),
('G460','lot5_figueres_central'),
('G461','lot5_figueres_central'),
('G462','lot5_figueres_cadaques'),
('G463','lot5_figueres_portbou'),
('G464','lot5_figueres_l_escala'),
('G465','lot5_figueres_la_jonquera'),
('G466','lot5_figueres_castello_d_empuries'),
('G467','lot5_figueres_roses'),
('G468','lot5_figueres_llanca'),
('G469','lot5_figueres_l_escala'),
('G433','lot5_figueres_la_bisbal_d_emporda'),
('G434','lot5_figueres_torroella_de_montgri_estartit'),
('G437','lot5_figueres_torroella_de_montgri_estartit'),
('G306','lot5_figueres_central'),
('G303','lot5_figueres_la_bisbal_d_emporda'),
('Material Supervisor · Figueres','lot5_figueres_central'),
('SL50','lot5_girona_central'),
('G213','lot5_girona_palamos'),
('G202','lot5_girona_llagostera'),
('G211','lot5_girona_salt'),
('G210','lot5_girona_central'),
('G212','lot5_girona_santa_coloma_de_farners'),
('G431','lot5_girona_palamos'),
('G432','lot5_girona_palafrugell'),
('G435','lot5_girona_sant_feliu_de_guixols'),
('G436','lot5_girona_castell_d_aro'),
('G438','lot5_girona_palafrugell'),
('G439','lot5_girona_palamos'),
('G410','lot5_girona_central'),
('G411','lot5_girona_central'),
('G412','lot5_girona_salt'),
('G414','lot5_girona_salt'),
('G415','lot5_girona_central'),
('G425','lot5_girona_cassa_de_la_selva'),
('G420','lot5_girona_sant_hilari_de_sacalm'),
('G421','lot5_girona_santa_coloma_de_farners'),
('G423','lot5_girona_angles'),
('BP50','lot5_girona_central'),
('G300','lot5_girona_central'),
('Material Supervisor · Girona','lot5_girona_central'),
('G204','lot5_blanes_calella'),
('G218','lot5_blanes_lloret_de_mar'),
('G217','lot5_blanes_central'),
('G440','lot5_blanes_calella'),
('G441','lot5_blanes_canet_de_mar'),
('G442','lot5_blanes_malgrat_de_mar'),
('G443','lot5_blanes_pineda_de_mar'),
('G444','lot5_blanes_pineda_de_mar'),
('G445','lot5_blanes_pineda_de_mar'),
('G446','lot5_blanes_calella'),
('G471','lot5_blanes_tordera'),
('G422','lot5_blanes_hostalric'),
('G424','lot5_blanes_macanet_de_la_selva'),
('G472','lot5_blanes_central'),
('G473','lot5_blanes_central'),
('G474','lot5_blanes_lloret_de_mar'),
('G475','lot5_blanes_lloret_de_mar'),
('G476','lot5_blanes_tossa_de_mar'),
('G477','lot5_blanes_central'),
('G478','lot5_blanes_lloret_de_mar'),
('BP51','lot5_blanes_central'),
('G307','lot5_blanes_central'),
('Material Supervisor · Blanes','lot5_blanes_central');
create temporary table expansion_materials(material text primary key) on commit drop;
insert into expansion_materials values
('Bolsa de recambio LSU'),
('Conector de vacío LSU'),
('Tubo de silicona LSU'),
('Sonda de aspiración Yankauer'),
('Sonda de aspiración 6'),
('Sonda de aspiración 8'),
('Sonda de aspiración 10'),
('Sonda de aspiración 12'),
('Sonda de aspiración 14'),
('Sonda de aspiración 16'),
('Sonda de aspiración 18'),
('Conexión en Y'),
('Parches schiller adulto'),
('Parches schiller pediátrico'),
('Parches monitorización schiller'),
('Cable ECG 4 derivadas'),
('Cable ECG 12 derivadas'),
('Sensor de pulsioximetría adulto'),
('Manguito TA pediátrico Schiller'),
('Manguito TA adulto Schiller'),
('Manguito TA obeso Schiller'),
('Parches dea tsnu'),
('Empapador'),
('Pañuelos de papel (caja)'),
('Kit de partos'),
('Tensiómetro digital'),
('Tensiómetro infrarrojo'),
('Manguito de tensiómetro infantil'),
('Equipo de infusión de suero'),
('Detector de monóxido'),
('Mascarilla Ambu 0'),
('Mascarilla Ambu 0a'),
('Mascarilla Ambu 2'),
('Mascarilla Ambu 3/4'),
('Mascarilla Ambu 5'),
('Mascarilla Ambu 6'),
('Filtro Ambu'),
('Válvula PEEP'),
('Rasuradora'),
('Kit quemados'),
('Mascarilla FPP2'),
('Mascarilla FPP3'),
('Mascarilla quirúrgica'),
('Collarín adulto'),
('Collarín pediátrico'),
('Faja pélvica'),
('Inmovilizador de hombro'),
('Férula Kramer (Hierro)'),
('Funda Kramer'),
('Férula maleable braquial'),
('Férula maleable digital'),
('Cánula Guedel Nº 00'),
('Cánula Guedel Nº 0'),
('Cánula Guedel Nº 1'),
('Cánula Guedel Nº 1,5'),
('Cánula Guedel Nº 2'),
('Cánula Guedel Nº 3'),
('Cánula Guedel Nº 4'),
('Cánula Guedel Nº 5'),
('Mascarilla oxígeno adulta'),
('Mascarilla monaghan adulta'),
('Mascarilla nebulización adulta'),
('Gafas nasales adultas'),
('Mascarilla oxígeno pediátrica'),
('Mascarilla monaghan pediátrica'),
('Mascarilla nebulización pediátrica'),
('Gafas nasales pediátricas'),
('Alargadera de O2'),
('Contenedor agujas pequeño'),
('Contenedor agujas grande'),
('Gel hidroalcohólico'),
('Bolsas de vómito'),
('Manta térmica'),
('Termómetro digital'),
('Termómetro infrarrojo'),
('Esfingotensiómetro manual'),
('Manguitos de esfigmomanómetro manual: neonatal'),
('Manguitos de esfigmomanómetro manual: pediátrico'),
('Manguitos de esfigmomanómetro manual: adulto'),
('Manguitos de esfigmomanómetro manual: obeso'),
('Fonendoscopio adulto'),
('Linterna pupilar'),
('Tiras reactivas'),
('Lancetas (caja)'),
('Glucómetro'),
('Celulosa cortada'),
('Torniquete'),
('Tijeras corta ropa'),
('Bolsa hielo'),
('Bolsa calor'),
('Sutura cutánea 100x6mm'),
('Sutura cutánea 100x12mm'),
('Pinzas estériles'),
('Tijeras estériles'),
('Esparadrapo plástico 2,5'),
('Venda crep 10cm x 4m'),
('Venda crep 10cm x 10m'),
('Venda gasa de 10 x 10'),
('Venda cohesiva 10 x 10'),
('Malla capelina para cabeza'),
('Suero fisiológico 5 ml'),
('Suero fisiológico 100ml'),
('Suero fisiológico 250 ml'),
('Clorhexidina 2%'),
('Gasas 20x20'),
('Gasas 40x40'),
('Apósito 7x2,5'),
('Apósito 10x8'),
('Apósito 20x8'),
('Cuña mujer'),
('Cuña hombre'),
('Guantes S (caja)'),
('Guantes M (caja)'),
('Guantes L (caja)'),
('Guantes XL (caja)'),
('Guantes estériles S'),
('Guantes estériles M'),
('Guantes estériles L'),
('Mantas de un solo uso'),
('Sábanas de un solo uso'),
('Bolsas de objetos personales SEM pequeñas'),
('Bolsas de objetos personales SEM grandes'),
('Pilas AA'),
('Pilas AAA'),
('Pilas CR123'),
('Talonario SEM'),
('Desinfectante'),
('Desengrasante'),
('Papel WC'),
('Bobina papel'),
('Bayetas'),
('Estropajos'),
('Fregona'),
('Escobas'),
('Palos de escoba-fregona'),
('Cubo para fregar'),
('Recogedor'),
('Palos de recogedor'),
('Escobilla WC'),
('Producto de limpieza pulverizador TSU'),
('Bolsas de basura negras'),
('Bolsas de residuos GII'),
('Jabón para platos'),
('Limpiacristales'),
('Pulsioxímetro de dedo');

-- Fail on conflicting existing configuration. Never reassign a unit silently.
do $$ begin
  if exists(select 1 from expansion_warehouses e join public.warehouses w using(id)
    where (w.lot,w.zone,w.name,w.kind) is distinct from (e.lot,e.zone,e.name,e.kind)) then
    raise exception 'EXISTING_WAREHOUSE_CONFLICT';
  end if;
  if exists(select 1 from expansion_assignments e join public.unit_warehouse_assignments a using(unit)
    where a.warehouse_id <> e.warehouse_id) then raise exception 'EXISTING_ASSIGNMENT_CONFLICT'; end if;
  if exists(select 1 from expansion_materials m left join public.warehouse_inventory i
    on i.material=m.material and i.warehouse_id='lot5_olot_camprodon'
    where i.minimum_quantity is null or i.minimum_quantity < 0) then
    raise exception 'MISSING_CAMPRODON_MINIMUM';
  end if;
end $$;

-- Keep the approved unit weights and initial one-ambulance minimum snapshot.
create table if not exists public.expansion_warehouse_weights (
  warehouse_id text primary key references public.warehouses(id),
  unit_count integer not null check(unit_count >= 0)
);
create table if not exists public.expansion_material_baselines (
  material text primary key, minimum_quantity integer not null check(minimum_quantity >= 0)
);
alter table public.expansion_warehouse_weights enable row level security;
alter table public.expansion_material_baselines enable row level security;
revoke all on public.expansion_warehouse_weights, public.expansion_material_baselines from public, anon, authenticated;

insert into public.warehouses(id,lot,zone,name,kind)
select id,lot,zone,name,kind from expansion_warehouses on conflict(id) do nothing;
insert into public.expansion_warehouse_weights
select id,unit_count from expansion_warehouses on conflict(warehouse_id) do nothing;
insert into public.expansion_material_baselines
select m.material,i.minimum_quantity from expansion_materials m join public.warehouse_inventory i
on i.material=m.material and i.warehouse_id='lot5_olot_camprodon' on conflict(material) do nothing;

-- One-time inventory insertion: never overwrite existing quantities or minimums.
insert into public.warehouse_inventory(warehouse_id,material,quantity,minimum_quantity,minimum_base_quantity,safety_percentage)
select w.id,m.material,1000,
  case when w.kind='central' then ceil(b.minimum_quantity * (select sum(e.unit_count) from expansion_warehouses e where e.zone=w.zone) * 1.30)::integer
       else b.minimum_quantity*w.unit_count end,
  case when w.kind='central' then b.minimum_quantity * (select sum(e.unit_count) from expansion_warehouses e where e.zone=w.zone)::integer
       else b.minimum_quantity*w.unit_count end,30
from expansion_warehouses w cross join expansion_materials m join public.expansion_material_baselines b on b.material=m.material
on conflict(warehouse_id,material) do nothing;

insert into public.unit_warehouse_assignments(unit,warehouse_id)
select unit,warehouse_id from expansion_assignments on conflict(unit) do nothing;

-- These functions are separate from Olot's existing calculation and permissions.
create or replace function public.recalculate_expansion_central(p_warehouse_id text, p_material text)
returns void language plpgsql security definer set search_path='' as $$
declare v_central text; v_zone text; v_base integer;
begin
  select w.zone into v_zone from public.warehouses w
  join public.expansion_warehouse_weights x on x.warehouse_id=w.id
  where w.id=p_warehouse_id and w.lot='Lot 5 · Girona - Alt Maresme'
    and w.zone in ('Figueres','Girona','Blanes');
  if v_zone is null then raise exception 'INVALID_EXPANSION_WAREHOUSE'; end if;
  select w.id into strict v_central from public.warehouses w
  join public.expansion_warehouse_weights x on x.warehouse_id=w.id
  where w.zone=v_zone and w.lot='Lot 5 · Girona - Alt Maresme' and w.kind='central';
  perform pg_advisory_xact_lock(hashtextextended(v_central || ':minimum:' || p_material,2));
  select b.minimum_quantity*x.unit_count into strict v_base
  from public.expansion_material_baselines b cross join public.expansion_warehouse_weights x
  where b.material=p_material and x.warehouse_id=v_central;
  select v_base+coalesce(sum(i.minimum_quantity),0)::integer into v_base
  from public.warehouse_inventory i join public.warehouses w on w.id=i.warehouse_id
  join public.expansion_warehouse_weights x on x.warehouse_id=w.id
  where w.zone=v_zone and w.lot='Lot 5 · Girona - Alt Maresme'
    and w.kind='subwarehouse' and i.material=p_material;
  update public.warehouse_inventory set minimum_base_quantity=v_base,
    minimum_quantity=ceil(v_base*(1+safety_percentage/100.0))::integer,updated_at=now()
  where warehouse_id=v_central and material=p_material;
end $$;
revoke all on function public.recalculate_expansion_central(text,text) from public,anon,authenticated;

create or replace function public.expansion_minimum_trigger()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.expansion_warehouse_weights x join public.warehouses w on w.id=x.warehouse_id
    where x.warehouse_id=new.warehouse_id and w.kind='subwarehouse') then
    perform public.recalculate_expansion_central(new.warehouse_id,new.material);
  end if;
  return new;
end $$;
revoke all on function public.expansion_minimum_trigger() from public,anon,authenticated;
drop trigger if exists expansion_minimum_changed on public.warehouse_inventory;
create trigger expansion_minimum_changed after update of minimum_quantity on public.warehouse_inventory
for each row when(old.minimum_quantity is distinct from new.minimum_quantity)
execute function public.expansion_minimum_trigger();

create or replace function public.set_expansion_safety_percentages(p_warehouse_id text,p_items jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare v_updated integer; v_requested integer; v_material text;
begin
  if not public.admin_has_role(array['owner','logistics']) then raise exception 'ADMIN_ROLE_ACCESS_DENIED'; end if;
  perform public.require_admin_warehouse(p_warehouse_id);
  if not exists(select 1 from public.warehouses w join public.expansion_warehouse_weights x on x.warehouse_id=w.id
    where w.id=p_warehouse_id and w.kind='central' and w.lot='Lot 5 · Girona - Alt Maresme'
      and w.zone in ('Figueres','Girona','Blanes')) then raise exception 'SAFETY_PERCENTAGE_ONLY_EXPANSION_CENTRAL'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'object' then raise exception 'INVALID_SAFETY_PERCENTAGES'; end if;
  if exists(select 1 from jsonb_each_text(p_items) i where i.value is null or i.value !~ '^\d+$') then raise exception 'INVALID_SAFETY_PERCENTAGE'; end if;
  if exists(select 1 from jsonb_each_text(p_items) i where i.value::numeric not between 0 and 200) then raise exception 'INVALID_SAFETY_PERCENTAGE'; end if;
  select count(*) into v_requested from jsonb_object_keys(p_items);
  update public.warehouse_inventory i set safety_percentage=j.value::integer,updated_at=now()
  from jsonb_each_text(p_items) j where i.warehouse_id=p_warehouse_id and i.material=j.key;
  get diagnostics v_updated=row_count;
  if v_updated<>v_requested then raise exception 'INVENTORY_ITEM_NOT_FOUND'; end if;
  for v_material in select jsonb_object_keys(p_items) order by 1 loop
    perform public.recalculate_expansion_central(p_warehouse_id,v_material);
  end loop;
  return v_updated;
end $$;
revoke all on function public.set_expansion_safety_percentages(text,jsonb) from public,anon;
grant execute on function public.set_expansion_safety_percentages(text,jsonb) to authenticated;

commit;
