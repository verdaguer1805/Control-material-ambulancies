-- Monitorización de solo lectura para el panel de administración.
-- No modifica tablas ni registros de la aplicación.

create or replace function public.get_database_usage()
returns table (
  database_bytes bigint,
  database_mb numeric
)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select
    pg_database_size(current_database())::bigint,
    round((pg_database_size(current_database())::numeric / 1024 / 1024), 2);
$$;

revoke all on function public.get_database_usage() from public;
grant execute on function public.get_database_usage() to authenticated;
