-- Registra el material consumido pendiente de reponer, aunque su mínimo sea cero.
alter table public.warehouse_inventory
  add column if not exists pending_replenishment integer not null default 0;

alter table public.warehouse_inventory
  drop constraint if exists warehouse_inventory_pending_replenishment_check;
alter table public.warehouse_inventory
  add constraint warehouse_inventory_pending_replenishment_check
  check (pending_replenishment >= 0);

create or replace function public.track_pending_replenishment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.movement_type in ('guard_consumption', 'transfer_out') then
    update public.warehouse_inventory
    set pending_replenishment = greatest(0, pending_replenishment - new.delta)
    where warehouse_id = new.warehouse_id and material = new.material;
  elsif new.movement_type in ('central_receipt', 'transfer_in') then
    update public.warehouse_inventory
    set pending_replenishment = greatest(0, pending_replenishment - new.delta)
    where warehouse_id = new.warehouse_id and material = new.material;
  end if;
  return new;
end;
$$;

drop trigger if exists track_pending_replenishment_on_movement on public.stock_movements;
create trigger track_pending_replenishment_on_movement
after insert on public.stock_movements
for each row execute function public.track_pending_replenishment();

create index if not exists warehouse_inventory_pending_idx
  on public.warehouse_inventory (warehouse_id, pending_replenishment)
  where pending_replenishment > 0;
