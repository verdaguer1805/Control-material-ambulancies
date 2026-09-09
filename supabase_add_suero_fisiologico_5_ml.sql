-- Añade el Suero fisiológico 5 ml a todos los inventarios existentes.
-- No modifica ningún otro material, stock ni mínimo.
insert into public.warehouse_inventory
  (warehouse_id, material, quantity, minimum_quantity, minimum_base_quantity, safety_percentage, updated_at)
select
  warehouse.id,
  'Suero fisiológico 5 ml',
  0,
  0,
  0,
  30,
  now()
from public.warehouses as warehouse
on conflict (warehouse_id, material) do nothing;

select public.recalculate_olot_central_minimum('Suero fisiológico 5 ml');
