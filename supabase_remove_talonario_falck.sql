-- Retira Talonario Falck de los inventarios actuales.
-- Los consumos y movimientos históricos se conservan para auditoría.
delete from public.warehouse_inventory
where material = 'Talonario Falck';
