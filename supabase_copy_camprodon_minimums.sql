-- Copia los mínimos actuales de Camprodon a Campdevànol, Banyoles y Sant Joan.
-- No modifica las existencias. Después recalcula los mínimos del almacén central.
begin;

update public.warehouse_inventory as destination
set
  minimum_quantity = source.minimum_quantity,
  updated_at = now()
from public.warehouse_inventory as source
where source.warehouse_id = 'lot5_olot_camprodon'
  and destination.warehouse_id in (
    'lot5_olot_campdevanol',
    'lot5_olot_banyoles',
    'lot5_olot_sant_joan'
  )
  and destination.material = source.material
  and destination.minimum_quantity is distinct from source.minimum_quantity;

select public.recalculate_olot_central_minimum(source.material)
from public.warehouse_inventory as source
where source.warehouse_id = 'lot5_olot_camprodon';

commit;

-- El resultado debe ser 0 discrepancias en cada subalmacén.
select
  destination.warehouse_id,
  count(*) filter (
    where destination.minimum_quantity is distinct from source.minimum_quantity
  ) as discrepancias
from public.warehouse_inventory as source
join public.warehouse_inventory as destination
  on destination.material = source.material
 and destination.warehouse_id in (
   'lot5_olot_campdevanol',
   'lot5_olot_banyoles',
   'lot5_olot_sant_joan'
 )
where source.warehouse_id = 'lot5_olot_camprodon'
group by destination.warehouse_id
order by destination.warehouse_id;
