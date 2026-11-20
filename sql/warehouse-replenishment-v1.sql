-- New replenishment screen. Existing stock RPCs and unit consumption are unchanged.
-- Apply manually before publishing. No historical stock or movements are rewritten.
begin;
create schema if not exists app_private;
create table if not exists app_private.warehouse_replenishment_requests(
 request_id uuid primary key,
 actor_user_id uuid not null,
 payload jsonb not null,
 receipt jsonb not null,
 created_at timestamptz not null default now()
);
alter table app_private.warehouse_replenishment_requests enable row level security;
revoke all on app_private.warehouse_replenishment_requests from public,anon,authenticated;

create or replace function public.confirm_warehouse_replenishment(
 p_request_id uuid,p_lot text,p_zone text,p_origin_id text,p_destination_id text,p_items jsonb
) returns jsonb language plpgsql security definer set search_path='' as $function$
declare
 s public.admin_access_sessions%rowtype;
 destination public.warehouses%rowtype;
 origin public.warehouses%rowtype;
 previous app_private.warehouse_replenishment_requests%rowtype;
 payload jsonb; receipt jsonb; v_material text; operation uuid;
begin
 if auth.uid() is null then raise exception 'ADMIN_ROLE_ACCESS_DENIED'; end if;
 select * into s from public.admin_access_sessions where user_id=auth.uid() and expires_at>now();
 if s.role is null or s.role not in ('owner','logistics','supervisor') then raise exception 'ADMIN_ROLE_ACCESS_DENIED'; end if;
 if p_request_id is null then raise exception 'INVALID_ITEMS'; end if;
 select * into destination from public.warehouses where id=p_destination_id;
 if destination.id is null then raise exception 'INVALID_DESTINATION'; end if;
 if destination.lot is distinct from p_lot or destination.zone is distinct from p_zone then raise exception 'INVALID_SCOPE'; end if;
 if s.role='supervisor' and (s.zone is distinct from p_zone or
   (nullif(to_jsonb(s)->>'lot','') is not null and to_jsonb(s)->>'lot' is distinct from p_lot))
 then raise exception 'ADMIN_ZONE_ACCESS_DENIED'; end if;
 perform public.require_admin_warehouse(p_destination_id);
 if p_origin_id is null then
  if destination.kind is distinct from 'central' then raise exception 'INVALID_DESTINATION: external receipts go to central'; end if;
 else
  perform public.require_admin_warehouse(p_origin_id);
  select * into origin from public.warehouses where id=p_origin_id;
  if origin.id is null or origin.id=destination.id or origin.kind is distinct from 'central'
    or destination.kind is distinct from 'subwarehouse'
    or origin.lot is distinct from p_lot or origin.zone is distinct from p_zone
  then raise exception 'INVALID_TRANSFER'; end if;
 end if;
 if p_items is null or jsonb_typeof(p_items)<>'object' or p_items='{}'::jsonb then raise exception 'INVALID_ITEMS'; end if;
 if exists(select 1 from jsonb_each(p_items) i where jsonb_typeof(i.value)<>'number'
   or i.value::text !~ '^[0-9]+$' or (i.value::text)::numeric<1 or (i.value::text)::numeric>2147483647)
 then raise exception 'INVALID_QUANTITY'; end if;
 payload:=jsonb_build_object('lot',p_lot,'zone',p_zone,'origin',p_origin_id,'destination',p_destination_id,'items',p_items);
 perform pg_advisory_xact_lock(hashtextextended('warehouse-replenishment:'||p_request_id::text,0));
 select * into previous from app_private.warehouse_replenishment_requests where request_id=p_request_id;
 if found then
  if previous.actor_user_id<>auth.uid() or previous.payload<>payload then raise exception 'REPLENISHMENT_REQUEST_CONFLICT'; end if;
  return previous.receipt;
 end if;
 if exists(select 1 from jsonb_object_keys(p_items) m where not exists(
   select 1 from public.warehouse_inventory i join public.warehouses w on w.id=i.warehouse_id
   where i.material=m and w.lot=p_lot and w.zone=p_zone)) then raise exception 'UNKNOWN_MATERIAL'; end if;
 if p_origin_id is null then
  perform public.receive_central_stock(p_destination_id,p_items);
 else
  -- The legacy transfer updates rows; create missing destination rows explicitly at zero.
  -- Match its lock order and retain existing movement / pending-replenishment triggers.
  for v_material in select key from jsonb_each(p_items) order by key loop
   perform pg_advisory_xact_lock(hashtextextended(p_origin_id||':'||v_material,1));
   perform pg_advisory_xact_lock(hashtextextended(p_destination_id||':'||v_material,1));
   insert into public.warehouse_inventory(warehouse_id,material,quantity,updated_at)
   values(p_destination_id,v_material,0,now()) on conflict(warehouse_id,material) do nothing;
  end loop;
  operation:=public.transfer_stock_recorded(p_origin_id,p_destination_id,p_items);
 end if;
 receipt:=jsonb_build_object('request_id',p_request_id,'operation_id',operation,'destination',p_destination_id,'confirmed_at',clock_timestamp());
 insert into app_private.warehouse_replenishment_requests(request_id,actor_user_id,payload,receipt)
 values(p_request_id,auth.uid(),payload,receipt);
 return receipt;
end $function$;
revoke all on function public.confirm_warehouse_replenishment(uuid,text,text,text,text,jsonb) from public,anon;
grant execute on function public.confirm_warehouse_replenishment(uuid,text,text,text,text,jsonb) to authenticated;
commit;
