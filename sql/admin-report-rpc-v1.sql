-- Informes administrativos compatibles con RLS. Nunca abre las tablas al
-- cliente: valida la sesión administrativa y limita lote, zona y fechas.
begin;

create or replace function public.get_admin_report_data(
  p_lot text,
  p_zone text,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from timestamptz;
  v_until timestamptz;
  v_incidents jsonb;
  v_submissions jsonb;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if nullif(trim(p_lot), '') is null or nullif(trim(p_zone), '') is null
     or p_from is null or p_to is null or p_from > p_to
     or p_to - p_from > 366 then
    raise exception 'INVALID_REPORT_SCOPE';
  end if;
  if not public.admin_can_access_zone(p_zone) then
    raise exception 'ADMIN_ZONE_ACCESS_DENIED';
  end if;

  v_from := p_from::timestamp at time zone 'Europe/Madrid';
  v_until := (p_to + 1)::timestamp at time zone 'Europe/Madrid';

  select coalesce(jsonb_agg(to_jsonb(i) order by i.occurred_at desc), '[]'::jsonb)
    into v_incidents
  from public.incidents i
  where i.occurred_at >= v_from and i.occurred_at < v_until
    and (
      exists (
        select 1
        from public.unit_warehouse_assignments a
        join public.warehouses w on w.id = a.warehouse_id
        where a.unit = i.unit and w.lot = p_lot and w.zone = p_zone
      )
      or lower(trim(i.unit)) = lower('Material Supervisor · ' || p_zone)
    );

  select coalesce(jsonb_agg(to_jsonb(s) order by s.submitted_at), '[]'::jsonb)
    into v_submissions
  from public.guard_submissions s
  where s.submitted_at >= v_from and s.submitted_at < v_until
    and (
      exists (
        select 1
        from public.unit_warehouse_assignments a
        join public.warehouses w on w.id = a.warehouse_id
        where a.unit = s.unit and w.lot = p_lot and w.zone = p_zone
      )
      or lower(trim(s.unit)) = lower('Material Supervisor · ' || p_zone)
    );

  return jsonb_build_object(
    'incidents', v_incidents,
    'submissions', v_submissions
  );
end;
$$;

revoke all on function public.get_admin_report_data(text,text,date,date)
  from public, anon;
grant execute on function public.get_admin_report_data(text,text,date,date)
  to authenticated;

commit;
