-- Redueix la superfície pública sense canviar l'operativa autenticada.
-- No modifica dades, inventaris, dispositius, RLS ni permisos d'authenticated.

begin;

-- Aquestes taules només s'utilitzen després d'obtenir una sessió autenticada.
-- RLS ja està activa, però anon no necessita cap privilegi directe.
revoke all privileges on table public.backup_banyoles_incidents_pre_20260911 from anon;
revoke all privileges on table public.backup_banyoles_movements_pre_20260911 from anon;
revoke all privileges on table public.backup_banyoles_submissions_pre_20260911 from anon;
revoke all privileges on table public.guard_submissions from anon;
revoke all privileges on table public.incidents from anon;
revoke all privileges on table public.profiles from anon;
revoke all privileges on table public.stock_movements from anon;
revoke all privileges on table public.unit_warehouse_assignments from anon;
revoke all privileges on table public.warehouse_inventory from anon;
revoke all privileges on table public.warehouses from anon;

-- L'estat de capacitat només és necessari dins d'una sessió autenticada.
revoke execute on function public.get_database_usage() from public, anon;
grant execute on function public.get_database_usage() to authenticated;

-- Funcions internes: només les invoquen triggers o funcions propietàries.
revoke execute on function public.recalculate_olot_central_minimum(text)
  from public, anon, authenticated;
revoke execute on function public.recalculate_olot_central_minimum_trigger()
  from public, anon, authenticated;
revoke execute on function public.track_pending_replenishment()
  from public, anon, authenticated;

commit;
