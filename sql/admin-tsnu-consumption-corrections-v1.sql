-- Additive TSNU corrections: originals and retry/idempotency keys stay unchanged.
-- Installing this migration does not change any quantity or existing consumption.
begin;

create table if not exists public.tsnu_consumption_overrides (
 operation_id uuid primary key references public.tsnu_withdrawals(operation_id),
 materials jsonb not null,
 updated_at timestamptz not null default now()
);
create table if not exists public.tsnu_consumption_corrections (
 id uuid primary key default gen_random_uuid(),
 operation_id uuid not null references public.tsnu_withdrawals(operation_id),
 lot text not null, zone text not null, unit text not null,
 warehouse_id text not null references public.warehouses(id),
 material text not null,
 previous_quantity integer not null check(previous_quantity>=0),
 corrected_quantity integer not null check(corrected_quantity>=0),
 stock_delta integer not null, reason text not null,
 actor_user_id uuid not null references auth.users(id),
 actor_role text not null, actor_zone text,
 created_at timestamptz not null default clock_timestamp()
);
create index if not exists tsnu_corrections_scope_date on public.tsnu_consumption_corrections(lot,zone,created_at);
alter table public.tsnu_consumption_overrides enable row level security;
alter table public.tsnu_consumption_corrections enable row level security;
revoke all on public.tsnu_consumption_overrides,public.tsnu_consumption_corrections from public,anon,authenticated;

create or replace function public.correct_tsnu_consumption(
 p_operation_id uuid,p_lot text,p_material text,p_corrected_quantity integer,p_expected_quantity integer,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_shift public.tsnu_shift_sessions%rowtype;
 v_original public.tsnu_withdrawals%rowtype;
 v_materials jsonb; v_previous integer; v_delta integer;
 v_role text; v_role_zone text; v_id uuid:=gen_random_uuid();
begin
 if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 select role,zone into v_role,v_role_zone from public.admin_access_sessions
 where user_id=auth.uid() and expires_at>now();
 if v_role is null then raise exception 'ADMIN_ACCESS_REQUIRED'; end if;
 if p_operation_id is null or nullif(trim(p_material),'') is null or p_lot is null then raise exception 'INVALID_CORRECTION'; end if;
 if p_corrected_quantity is null or p_corrected_quantity<0 or p_expected_quantity is null or p_expected_quantity<0 then raise exception 'INVALID_CORRECTED_QUANTITY'; end if;
 if length(trim(coalesce(p_reason,'')))<5 then raise exception 'CORRECTION_REASON_REQUIRED'; end if;

 select * into v_original from public.tsnu_withdrawals where operation_id=p_operation_id for update;
 if not found then raise exception 'WITHDRAWAL_NOT_FOUND'; end if;
 select * into v_shift from public.tsnu_shift_sessions where id=v_original.shift_id for update;
 if v_shift.lot is distinct from p_lot or not public.admin_can_access_zone(v_shift.zone)
 then raise exception 'ADMIN_ZONE_ACCESS_DENIED'; end if;
 if not exists(select 1 from public.warehouses where id=v_shift.warehouse_id and lot=p_lot and zone=v_shift.zone)
 then raise exception 'UNIT_WAREHOUSE_NOT_CONFIGURED'; end if;
 if v_shift.ended_at is null then raise exception 'GUARD_STILL_ACTIVE'; end if;

 select materials into v_materials from public.tsnu_consumption_overrides where operation_id=p_operation_id;
 v_materials:=coalesce(v_materials,v_original.materials,'{}'::jsonb);
 v_previous:=coalesce((v_materials->>p_material)::integer,0);
 if v_previous<>p_expected_quantity then raise exception 'CORRECTION_CONFLICT'; end if;
 if v_previous=p_corrected_quantity then raise exception 'CORRECTION_WITHOUT_CHANGES'; end if;
 v_delta:=v_previous-p_corrected_quantity;
 if p_corrected_quantity=0 then v_materials:=v_materials-p_material;
 else v_materials:=jsonb_set(v_materials,array[p_material],to_jsonb(p_corrected_quantity),true); end if;

 perform pg_advisory_xact_lock(hashtextextended(v_shift.warehouse_id||':'||p_material,1));
 update public.warehouse_inventory set quantity=quantity+v_delta,
 pending_replenishment=greatest(0,pending_replenishment-v_delta),updated_at=now()
 where warehouse_id=v_shift.warehouse_id and material=p_material;
 if not found then raise exception 'INVENTORY_MATERIAL_NOT_FOUND'; end if;
 insert into public.tsnu_consumption_overrides(operation_id,materials)
 values(p_operation_id,v_materials) on conflict(operation_id) do update set materials=excluded.materials,updated_at=now();
 insert into public.stock_movements(warehouse_id,unit,guard_code,material,delta,movement_type,operation_id,performed_role,performed_zone)
 values(v_shift.warehouse_id,v_shift.unit,to_char(v_shift.started_at at time zone 'Europe/Madrid','DDMMYY'),p_material,v_delta,'consumption_correction',v_id,v_role,v_role_zone);
 insert into public.tsnu_consumption_corrections(id,operation_id,lot,zone,unit,warehouse_id,material,previous_quantity,corrected_quantity,stock_delta,reason,actor_user_id,actor_role,actor_zone)
 values(v_id,p_operation_id,v_shift.lot,v_shift.zone,v_shift.unit,v_shift.warehouse_id,p_material,v_previous,p_corrected_quantity,v_delta,trim(p_reason),auth.uid(),v_role,v_role_zone);
 return jsonb_build_object('correction_id',v_id,'operation_id',p_operation_id,'previous_quantity',v_previous,'corrected_quantity',p_corrected_quantity,'stock_delta',v_delta);
end $$;
revoke all on function public.correct_tsnu_consumption(uuid,text,text,integer,integer,text) from public,anon;
grant execute on function public.correct_tsnu_consumption(uuid,text,text,integer,integer,text) to authenticated;

-- Existing exports and the correction selector see effective quantities.
create or replace function public.get_tsnu_report_data(p_lot text,p_zone text,p_from date,p_to date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_from timestamptz;v_until timestamptz;
begin
 if auth.uid() is null or not public.admin_can_access_zone(p_zone) then raise exception 'ADMIN_ZONE_ACCESS_DENIED'; end if;
 if p_lot is null or p_zone is null or p_from is null or p_to is null or p_from>p_to then raise exception 'INVALID_REPORT_RANGE'; end if;
 v_from:=p_from::timestamp at time zone 'Europe/Madrid';
 v_until:=(p_to+1)::timestamp at time zone 'Europe/Madrid';
 return jsonb_build_object(
 'shifts',coalesce((select jsonb_agg(jsonb_build_object(
 'id',s.id,'lot',s.lot,'zone',s.zone,'unit',s.unit,'warehouse_id',s.warehouse_id,'warehouse',w.name,
 'checklist_version',s.checklist_version,'started_at',s.started_at,'checklist_answers',s.checklist_answers,
 'checklist_submitted_at',s.checklist_submitted_at,'ended_at',s.ended_at,'close_source',s.close_source
 ) order by s.started_at) from public.tsnu_shift_sessions s join public.warehouses w on w.id=s.warehouse_id
 where s.lot=p_lot and s.zone=p_zone and s.started_at>=v_from and s.started_at<v_until),'[]'::jsonb),
 'withdrawals',coalesce((select jsonb_agg(jsonb_build_object(
 'operation_id',x.operation_id,'shift_id',x.shift_id,'unit',s.unit,'warehouse',w.name,
 'materials',coalesce(o.materials,x.materials),'created_at',x.created_at
 ) order by x.created_at) from public.tsnu_withdrawals x join public.tsnu_shift_sessions s on s.id=x.shift_id
 join public.warehouses w on w.id=s.warehouse_id
 left join public.tsnu_consumption_overrides o on o.operation_id=x.operation_id
 where s.lot=p_lot and s.zone=p_zone and s.started_at>=v_from and s.started_at<v_until),'[]'::jsonb));
end $$;
revoke all on function public.get_tsnu_report_data(text,text,date,date) from public,anon;
grant execute on function public.get_tsnu_report_data(text,text,date,date) to authenticated;
commit;
