-- Centralitza a Supabase el tipus logístic i la visibilitat de cada material.
-- Segur per repetir: no modifica inventaris, mínims, consums ni moviments.
begin;

alter table public.material_settings
  add column if not exists unit_visible boolean not null default true;

-- Conserva la visibilitat actual de la PWA. Les piles continuen visibles.
update public.material_settings
set unit_visible = false
where lower(material) = any(array[
  'cable ecg 4 derivadas','cable ecg 12 derivadas','sensor de pulsioximetría adulto',
  'manguito ta pediátrico schiller','manguito ta adulto schiller','manguito ta obeso schiller',
  'tensiómetro digital','tensiómetro infrarrojo','manguito de tensiómetro infantil',
  'detector de monóxido','parches dea tsnu','mascarilla ambu 0','mascarilla ambu 0a',
  'mascarilla ambu 2','mascarilla ambu 3/4','mascarilla ambu 5','mascarilla ambu 6',
  'termómetro digital','termómetro infrarrojo','esfingotensiómetro manual',
  'manguitos de esfigmomanómetro manual: pediátrico',
  'manguitos de esfigmomanómetro manual: adulto',
  'manguitos de esfigmomanómetro manual: obeso',
  'manguitos de esfigmomanómetro manual: neonatal','fonendoscopio adulto',
  'linterna pupilar','glucómetro','tijeras corta ropa','desengrasante','papel wc',
  'bobina papel','bayetas','estropajos','fregona','escobas','palos de escoba-fregona',
  'cubo para fregar','recogedor','palos de recogedor','escobilla wc',
  'bolsas de basura negras','producto de limpieza pulverizador tsu','jabón para platos',
  'limpiacristales','pulsioxímetro de dedo','desinfectante'
]);

update public.material_settings
set unit_visible = true
where material in ('Pilas AA','Pilas AAA','Pilas CR123');

create or replace function public.set_material_configuration(
  p_material text,
  p_supply_type text,
  p_unit_visible boolean
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_updated integer;
begin
  if not public.admin_has_role(array['owner','logistics']) then
    raise exception 'ADMIN_ROLE_ACCESS_DENIED';
  end if;
  if p_material is null or length(trim(p_material)) = 0
     or p_supply_type not in ('standard','supervisor')
     or p_unit_visible is null then
    raise exception 'INVALID_MATERIAL_CONFIGURATION';
  end if;

  update public.material_settings
  set supply_type = p_supply_type,
      unit_visible = p_unit_visible
  where material = p_material;
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then raise exception 'UNKNOWN_MATERIAL'; end if;
  return v_updated;
end;
$$;

revoke all on function public.set_material_configuration(text,text,boolean) from public,anon;
grant execute on function public.set_material_configuration(text,text,boolean) to authenticated;

commit;

select material,supply_type,unit_visible
from public.material_settings
order by material;
