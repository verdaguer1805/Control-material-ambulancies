-- Restaura la Cánula Guedel Nº 1,5 en todos los inventarios existentes.
-- No modifica las existencias ni los mínimos de ningún otro material.
insert into public.warehouse_inventory
  (warehouse_id, material, quantity, minimum_quantity, minimum_base_quantity, safety_percentage, updated_at)
select
  warehouse.id,
  'Cánula Guedel Nº 1,5',
  0,
  0,
  0,
  30,
  now()
from public.warehouses as warehouse
on conflict (warehouse_id, material) do nothing;

select public.recalculate_olot_central_minimum('Cánula Guedel Nº 1,5');
