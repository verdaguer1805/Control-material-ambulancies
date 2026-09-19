-- Lectura protegida para integrar TSNU en los informes de administración.
-- No modifica consumos, inventario ni movimientos.
begin;

create or replace function public.get_tsnu_report_data(
  p_lot text,
  p_zone text,
  p_from date,
  p_to date
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from timestamptz;
  v_until timestamptz;
begin
  if auth.uid() is null or not public.admin_can_access_zone(p_zone) then
    raise exception 'ADMIN_ZONE_ACCESS_DENIED';
  end if;
  if p_lot is null or p_zone is null or p_from is null or p_to is null or p_from > p_to then
    raise exception 'INVALID_REPORT_RANGE';
  end if;

  v_from := p_from::timestamp at time zone 'Europe/Madrid';
  v_until := (p_to + 1)::timestamp at time zone 'Europe/Madrid';

  return jsonb_build_object(
    'shifts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'lot', s.lot,
        'zone', s.zone,
        'unit', s.unit,
        'warehouse_id', s.warehouse_id,
        'warehouse', w.name,
        'checklist_version', s.checklist_version,
        'started_at', s.started_at,
        'checklist_answers', s.checklist_answers,
        'checklist_submitted_at', s.checklist_submitted_at,
        'ended_at', s.ended_at
      ) order by s.started_at)
      from public.tsnu_shift_sessions s
      join public.warehouses w on w.id = s.warehouse_id
      where s.lot = p_lot and s.zone = p_zone
        and s.started_at >= v_from and s.started_at < v_until
    ), '[]'::jsonb),
    'withdrawals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'operation_id', x.operation_id,
        'shift_id', x.shift_id,
        'unit', s.unit,
        'warehouse', w.name,
        'materials', x.materials,
        'created_at', x.created_at
      ) order by x.created_at)
      from public.tsnu_withdrawals x
      join public.tsnu_shift_sessions s on s.id = x.shift_id
      join public.warehouses w on w.id = s.warehouse_id
      where s.lot = p_lot and s.zone = p_zone
        and s.started_at >= v_from and s.started_at < v_until
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_tsnu_report_data(text,text,date,date) from public, anon;
grant execute on function public.get_tsnu_report_data(text,text,date,date) to authenticated;

commit;
