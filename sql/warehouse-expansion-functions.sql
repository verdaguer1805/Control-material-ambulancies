
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
