-- Named mobile auditors. Additive; existing supervisor/unit activations unchanged.
-- Install before enabling the new UI. No inventory reset or historical rewrite.
begin;
create table if not exists public.auditor_devices(
 user_id uuid primary key references auth.users(id),full_name text not null,
 lot text not null,zone text not null,warehouse_id text not null references public.warehouses(id),
 revision integer not null default 1,active boolean not null default true,
 authorized_role text not null,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp()
);
create table if not exists public.auditor_access_attempts(user_id uuid primary key references auth.users(id),failures integer not null default 0,blocked_until timestamptz);
create table if not exists public.auditor_access_history(
 id bigint generated always as identity primary key,user_id uuid not null,actor_user_id uuid not null,
 action text not null,old_profile jsonb,new_profile jsonb,created_at timestamptz not null default clock_timestamp()
);
create table if not exists public.auditor_audit_drafts(
 id uuid primary key,user_id uuid not null references auth.users(id),profile_revision integer not null,
 full_name text not null,lot text not null,zone text not null,warehouse_id text not null,
 vehicle text not null,checklist_type text not null,catalog jsonb not null,answers jsonb not null default '{}',notes jsonb not null default '{}',
 edit_version bigint not null default 0,started_at timestamptz not null default clock_timestamp(),submitted_at timestamptz
);
create index if not exists auditor_drafts_pending on public.auditor_audit_drafts(user_id) where submitted_at is null;
create table if not exists public.auditor_material_drafts(
 user_id uuid primary key references auth.users(id),id uuid not null,profile_revision integer not null,
 materials jsonb not null default '{}',edit_version bigint not null default 0,updated_at timestamptz not null default clock_timestamp()
);
create table if not exists public.auditor_withdrawals(
 id uuid primary key,user_id uuid not null references auth.users(id),profile_revision integer not null,
 full_name text not null,lot text not null,zone text not null,warehouse_id text not null references public.warehouses(id),
 materials jsonb not null,created_at timestamptz not null default clock_timestamp()
);
do $$ declare t text; begin
 foreach t in array array['auditor_devices','auditor_access_attempts','auditor_access_history','auditor_audit_drafts','auditor_material_drafts','auditor_withdrawals'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
end $$;

create or replace function app_private.require_mobile_auditor(p_revision integer default null)
returns public.auditor_devices language plpgsql security definer set search_path='' as $$
declare p public.auditor_devices%rowtype; begin
 select * into p from public.auditor_devices where user_id=auth.uid() for update;
 if p.user_id is null or not p.active then raise exception 'AUDITOR_NOT_AUTHORIZED'; end if;
 if p_revision is not null and p.revision<>p_revision then raise exception 'AUDITOR_ASSIGNMENT_CHANGED'; end if;
 if not exists(select 1 from public.warehouses w where w.id=p.warehouse_id and w.lot=p.lot and w.zone=p.zone) then raise exception 'AUDITOR_WAREHOUSE_MISMATCH'; end if;
 return p;
end $$;
revoke all on function app_private.require_mobile_auditor(integer) from public,anon,authenticated;

create or replace function public.get_my_auditor_profile()
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.auditor_devices%rowtype; w text; begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select * into p from public.auditor_devices where user_id=auth.uid();
 if p.user_id is null then return null; end if;
 select name into w from public.warehouses where id=p.warehouse_id and lot=p.lot and zone=p.zone;
 return to_jsonb(p)||jsonb_build_object('warehouse_name',w,'verified',p.active and w is not null);
end $$;

-- Public warehouse labels only; never stock quantities or administrator access.
create or replace function public.get_auditor_warehouse_options()
returns jsonb language sql stable security definer set search_path='' as $$
 select case when auth.uid() is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'lot',lot,'zone',zone,'kind',kind) order by lot,zone,kind,name) from public.warehouses),'[]'::jsonb) end
$$;

create or replace function public.authorize_mobile_auditor(p_code text,p_full_name text,p_lot text,p_zone text,p_warehouse_id text,p_close_unit boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare old public.auditor_devices%rowtype; code_row app_private.admin_access_codes%rowtype; a public.auditor_access_attempts%rowtype; normalized text; begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 normalized:=regexp_replace(btrim(coalesce(p_full_name,'')),'\s+',' ','g');
 if length(normalized)<5 or length(normalized)>100 or normalized !~ '^\S+\s+\S+' then raise exception 'AUDITOR_FULL_NAME_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,894));
 insert into public.auditor_access_attempts(user_id) values(auth.uid()) on conflict do nothing;
 select * into a from public.auditor_access_attempts where user_id=auth.uid() for update;
 if a.blocked_until>clock_timestamp() then return jsonb_build_object('error','AUDITOR_ACCESS_LOCKED'); end if;
 if a.blocked_until is not null then update public.auditor_access_attempts set failures=0,blocked_until=null where user_id=auth.uid(); a.failures:=0; end if;
 if p_code is not null and length(p_code) between 6 and 64 then
 select * into code_row from app_private.admin_access_codes
 where (role='owner' or (role='supervisor' and zone=p_zone)) and extensions.crypt(p_code,code_hash)=code_hash limit 1;
 end if;
 if code_row.role is null then
 update public.auditor_access_attempts set failures=a.failures+1,blocked_until=case when a.failures+1>=3 then clock_timestamp()+interval '15 minutes' else null end where user_id=auth.uid();
 return jsonb_build_object('error','INVALID_AUDITOR_AUTHORIZATION'); end if;
 if not exists(select 1 from public.warehouses where id=p_warehouse_id and lot=p_lot and zone=p_zone) then raise exception 'AUDITOR_WAREHOUSE_MISMATCH'; end if;
 select * into old from public.auditor_devices where user_id=auth.uid() for update;
 if exists(select 1 from public.auditor_audit_drafts where user_id=auth.uid() and submitted_at is null)
 or exists(select 1 from public.auditor_material_drafts d cross join lateral jsonb_each_text(d.materials) m where d.user_id=auth.uid() and m.value::numeric>0)
 then raise exception 'AUDITOR_PENDING_WORK'; end if;
 if exists(select 1 from public.tsnu_shift_sessions where user_id=auth.uid() and ended_at is null) then
 if p_close_unit is distinct from true then raise exception 'UNIT_SHIFT_MUST_BE_CLOSED'; end if;
 -- Explicitly close the previous phone role; never invent completed answers.
 update public.tsnu_shift_sessions set ended_at=greatest(clock_timestamp(),started_at),close_source='manual'
 where user_id=auth.uid() and ended_at is null;
 end if;
 insert into public.auditor_devices(user_id,full_name,lot,zone,warehouse_id,authorized_role)
 values(auth.uid(),normalized,p_lot,p_zone,p_warehouse_id,code_row.role)
 on conflict(user_id) do update set full_name=excluded.full_name,lot=excluded.lot,zone=excluded.zone,warehouse_id=excluded.warehouse_id,
 active=true,revision=public.auditor_devices.revision+1,authorized_role=excluded.authorized_role,updated_at=clock_timestamp();
 -- Only this phone switches role; never revoke another supervisor/unit phone.
 update public.device_authorizations set active=false where user_id=auth.uid() and active;
 delete from public.auditor_material_drafts where user_id=auth.uid();
 delete from public.auditor_access_attempts where user_id=auth.uid();
 -- Using a code here does NOT create an administrator session.
 delete from public.admin_access_sessions where user_id=auth.uid();
 insert into public.auditor_access_history(user_id,actor_user_id,action,old_profile,new_profile)
 values(auth.uid(),auth.uid(),case when old.user_id is null then 'authorize' else 'reassign' end,to_jsonb(old),public.get_my_auditor_profile());
 return public.get_my_auditor_profile();
end $$;

create or replace function public.begin_mobile_auditor_audit(p_id uuid,p_revision integer,p_vehicle text,p_type text,p_catalog jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.auditor_devices%rowtype; d public.auditor_audit_drafts%rowtype; begin
 p:=app_private.require_mobile_auditor(p_revision);
 if p_id is null or upper(btrim(coalesce(p_vehicle,''))) !~ '^[A-Z0-9][A-Z0-9-]{2,19}$' or p_type is null or p_type not in ('TSNU','SVB')
 or p_catalog is null or jsonb_typeof(p_catalog)<>'array' then raise exception 'INVALID_VEHICLE_AUDIT'; end if;
 if jsonb_array_length(p_catalog) not between 1 and 1000 or exists(select 1 from jsonb_array_elements(p_catalog) x where coalesce(x->>'id','')='' or coalesce(x->>'label','')='' or coalesce(x->>'section','')='') then raise exception 'INVALID_VEHICLE_AUDIT'; end if;
 if (select count(distinct x->>'id') from jsonb_array_elements(p_catalog)x)<>jsonb_array_length(p_catalog) then raise exception 'INVALID_VEHICLE_AUDIT'; end if;
 select * into d from public.auditor_audit_drafts where id=p_id;
 if d.id is not null then
 if d.user_id<>auth.uid() or d.profile_revision<>p.revision or d.vehicle<>upper(btrim(p_vehicle)) or d.checklist_type<>p_type or d.catalog<>p_catalog then raise exception 'AUDIT_ID_CONFLICT'; end if;
 return to_jsonb(d); end if;
 insert into public.auditor_audit_drafts(id,user_id,profile_revision,full_name,lot,zone,warehouse_id,vehicle,checklist_type,catalog)
 values(p_id,auth.uid(),p.revision,p.full_name,p.lot,p.zone,p.warehouse_id,upper(btrim(p_vehicle)),p_type,p_catalog) returning * into d;
 return to_jsonb(d);
end $$;

create or replace function public.save_mobile_auditor_draft(p_id uuid,p_revision integer,p_version bigint,p_answers jsonb,p_notes jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare p public.auditor_devices%rowtype; d public.auditor_audit_drafts%rowtype; begin
 p:=app_private.require_mobile_auditor(p_revision);
 select * into d from public.auditor_audit_drafts where id=p_id and user_id=auth.uid() for update;
 if d.id is null or d.profile_revision<>p.revision then raise exception 'AUDIT_ID_CONFLICT'; end if;
 if d.submitted_at is not null then return true; end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'object' or p_notes is null or jsonb_typeof(p_notes)<>'object' or p_version is null then raise exception 'INVALID_VEHICLE_AUDIT'; end if;
 if exists(select 1 from jsonb_each_text(p_answers) a where a.value is null or a.value not in ('ok','issue') or not exists(select 1 from jsonb_array_elements(d.catalog)x where x->>'id'=a.key)) then raise exception 'INVALID_VEHICLE_AUDIT'; end if;
 update public.auditor_audit_drafts set answers=p_answers,notes=p_notes,edit_version=p_version where id=p_id and edit_version<p_version;
 return true;
end $$;

create or replace function public.get_my_auditor_pending_audits()
returns jsonb language plpgsql security definer set search_path='' as $$
begin perform app_private.require_mobile_auditor();
 return coalesce((select jsonb_agg(to_jsonb(d) order by d.started_at) from public.auditor_audit_drafts d where user_id=auth.uid() and submitted_at is null),'[]'); end $$;

create or replace function public.submit_mobile_auditor_audit(p_id uuid,p_revision integer,p_vehicle text,p_type text,p_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.auditor_devices%rowtype; d public.auditor_audit_drafts%rowtype; r public.supervisor_vehicle_audits%rowtype; c jsonb; begin
 p:=app_private.require_mobile_auditor(p_revision);
 select * into d from public.auditor_audit_drafts where id=p_id and user_id=auth.uid() for update;
 if d.id is null or d.profile_revision<>p.revision or d.lot<>p.lot or d.zone<>p.zone or d.warehouse_id<>p.warehouse_id then raise exception 'AUDIT_ID_CONFLICT'; end if;
 if upper(btrim(coalesce(p_vehicle,'')))<>d.vehicle or p_type is distinct from d.checklist_type or p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'INVALID_VEHICLE_AUDIT'; end if;
 if jsonb_array_length(p_items)<>jsonb_array_length(d.catalog) or exists(select 1 from jsonb_array_elements(p_items)x where coalesce(x->>'status','') not in ('ok','issue') or length(coalesce(x->>'note',''))>1000) then raise exception 'INCOMPLETE_VEHICLE_AUDIT'; end if;
 select jsonb_agg(x-'status'-'note' order by ord) into c from jsonb_array_elements(p_items) with ordinality a(x,ord);
 if c is distinct from d.catalog then raise exception 'INVALID_VEHICLE_AUDIT'; end if;
 select * into r from public.supervisor_vehicle_audits where id=p_id;
 if r.id is not null then
 if r.auditor_id<>auth.uid() or r.items<>p_items then raise exception 'AUDIT_ALREADY_CONFIRMED'; end if; return to_jsonb(r); end if;
 insert into public.supervisor_vehicle_audits(id,lot,zone,supervisor,auditor_id,vehicle,checklist_type,items)
 values(p_id,d.lot,d.zone,'Auditor · '||d.zone||' · '||d.full_name,auth.uid(),d.vehicle,d.checklist_type,p_items) returning * into r;
 update public.auditor_audit_drafts set submitted_at=r.received_at where id=p_id;
 return to_jsonb(r);
end $$;

create or replace function app_private.valid_auditor_materials(p_items jsonb)
returns boolean language plpgsql immutable set search_path='' as $$ begin
 if p_items is null or jsonb_typeof(p_items)<>'object' then return false; end if;
 return not exists(select 1 from jsonb_each_text(p_items)i where i.value is null or i.value !~ '^[0-9]+$' or length(i.value)>10 or i.value::numeric>2147483647);
end $$;
revoke all on function app_private.valid_auditor_materials(jsonb) from public,anon,authenticated;

create or replace function public.save_mobile_auditor_materials(p_id uuid,p_revision integer,p_version bigint,p_items jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare p public.auditor_devices%rowtype; begin
 p:=app_private.require_mobile_auditor(p_revision);
 if p_id is null or p_version is null or not app_private.valid_auditor_materials(p_items) then raise exception 'INVALID_QUANTITY'; end if;
 if exists(select 1 from public.auditor_withdrawals where id=p_id) then raise exception 'AUDITOR_CONSUMPTION_ALREADY_SENT'; end if;
 if exists(select 1 from public.auditor_material_drafts d cross join lateral jsonb_each_text(d.materials)m where d.user_id=auth.uid() and d.id<>p_id and m.value::numeric>0) then raise exception 'AUDITOR_PENDING_WORK'; end if;
 insert into public.auditor_material_drafts(user_id,id,profile_revision,materials,edit_version)
 values(auth.uid(),p_id,p.revision,p_items,p_version)
 on conflict(user_id) do update set id=excluded.id,profile_revision=excluded.profile_revision,materials=excluded.materials,edit_version=excluded.edit_version,updated_at=clock_timestamp()
 where public.auditor_material_drafts.edit_version<excluded.edit_version or public.auditor_material_drafts.id<>excluded.id;
 return true;
end $$;

create or replace function public.get_my_auditor_materials()
returns jsonb language plpgsql security definer set search_path='' as $$ begin
 perform app_private.require_mobile_auditor(); return (select to_jsonb(d) from public.auditor_material_drafts d where user_id=auth.uid()); end $$;

create or replace function public.get_my_auditor_material_options()
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.auditor_devices%rowtype; begin
 p:=app_private.require_mobile_auditor();
 return coalesce((select jsonb_agg(material order by material) from public.warehouse_inventory where warehouse_id=p.warehouse_id),'[]');
end $$;

create or replace function public.get_my_auditor_consumption(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 return(select to_jsonb(r) from public.auditor_withdrawals r where id=p_id and user_id=auth.uid()); end $$;

create or replace function public.submit_mobile_auditor_consumption(p_id uuid,p_revision integer,p_warehouse_id text,p_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.auditor_devices%rowtype; r public.auditor_withdrawals%rowtype; m text; q integer; d public.auditor_material_drafts%rowtype; begin
 if auth.uid() is null or p_id is null then raise exception 'AUDITOR_NOT_AUTHORIZED'; end if;
 select * into r from public.auditor_withdrawals where id=p_id;
 if r.id is not null then
 if r.user_id<>auth.uid() or r.profile_revision<>p_revision or r.warehouse_id is distinct from p_warehouse_id or r.materials is distinct from p_items then raise exception 'AUDITOR_OPERATION_CONFLICT'; end if; return to_jsonb(r); end if;
 p:=app_private.require_mobile_auditor(p_revision);
 if p.warehouse_id is distinct from p_warehouse_id then raise exception 'AUDITOR_WAREHOUSE_MISMATCH'; end if;
 if not app_private.valid_auditor_materials(p_items) or not exists(select 1 from jsonb_each_text(p_items)i where i.value::numeric>0) then raise exception 'INVALID_QUANTITY'; end if;
 -- Recheck after the profile lock: concurrent retries debit exactly once.
 select * into r from public.auditor_withdrawals where id=p_id;
 if r.id is not null then
 if r.user_id<>auth.uid() or r.profile_revision<>p_revision or r.warehouse_id is distinct from p_warehouse_id or r.materials is distinct from p_items then raise exception 'AUDITOR_OPERATION_CONFLICT'; end if; return to_jsonb(r); end if;
 select * into d from public.auditor_material_drafts where user_id=auth.uid() for update;
 if d.id is distinct from p_id or d.profile_revision<>p.revision or d.materials is distinct from p_items then raise exception 'AUDITOR_PENDING_WORK'; end if;
 for m,q in select key,value::integer from jsonb_each_text(p_items) order by key loop
 if q=0 then continue; end if;
 perform pg_advisory_xact_lock(hashtextextended(p.warehouse_id||':'||m,1));
 if not exists(select 1 from public.warehouse_inventory where warehouse_id=p.warehouse_id and material=m) then raise exception 'INVENTORY_ITEM_NOT_FOUND'; end if;
 update public.warehouse_inventory set quantity=quantity-q,pending_replenishment=pending_replenishment+q,updated_at=now() where warehouse_id=p.warehouse_id and material=m;
 insert into public.stock_movements(warehouse_id,unit,material,delta,movement_type,operation_id,performed_role,performed_zone,actor_user_id)
 values(p.warehouse_id,'Auditor · '||p.zone||' · '||p.full_name,m,-q,'auditor_consumption',p_id,'auditor',p.zone,auth.uid());
 end loop;
 insert into public.auditor_withdrawals(id,user_id,profile_revision,full_name,lot,zone,warehouse_id,materials)
 values(p_id,auth.uid(),p.revision,p.full_name,p.lot,p.zone,p.warehouse_id,p_items) returning * into r;
 delete from public.auditor_material_drafts where user_id=auth.uid() and id=p_id;
 return to_jsonb(r);
end $$;

create or replace function public.list_mobile_auditors()
returns jsonb language plpgsql security definer set search_path='' as $$ begin
 if not public.admin_has_role(array['owner','supervisor']) then raise exception 'ADMIN_ROLE_ACCESS_DENIED'; end if;
 return coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('warehouse_name',w.name) order by p.zone,p.full_name)
 from public.auditor_devices p join public.warehouses w on w.id=p.warehouse_id where public.admin_can_access_zone(p.zone)),'[]'); end $$;

create or replace function public.revoke_mobile_auditor(p_user_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare old public.auditor_devices%rowtype; begin
 if not public.admin_has_role(array['owner','supervisor']) then raise exception 'ADMIN_ROLE_ACCESS_DENIED'; end if;
 select * into old from public.auditor_devices where user_id=p_user_id for update;
 if old.user_id is null or not public.admin_can_access_zone(old.zone) then raise exception 'ADMIN_ZONE_ACCESS_DENIED'; end if;
 update public.auditor_devices set active=false,updated_at=clock_timestamp() where user_id=p_user_id;
 insert into public.auditor_access_history(user_id,actor_user_id,action,old_profile,new_profile) values(p_user_id,auth.uid(),'revoke',to_jsonb(old),null);
 return true;
end $$;

create or replace function public.get_auditor_consumption_report(p_lot text,p_zone text,p_from date,p_to date)
returns jsonb language plpgsql security definer set search_path='' as $$ begin
 if not public.admin_can_access_zone(p_zone) then raise exception 'ADMIN_ZONE_ACCESS_DENIED'; end if;
 if p_lot is null or p_zone is null or p_from is null or p_to is null or p_from>p_to then raise exception 'INVALID_REPORT_RANGE'; end if;
 return coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('warehouse_name',w.name) order by r.created_at)
 from public.auditor_withdrawals r join public.warehouses w on w.id=r.warehouse_id
 where r.lot=p_lot and r.zone=p_zone and r.created_at>=(p_from::timestamp at time zone 'Europe/Madrid') and r.created_at<((p_to+1)::timestamp at time zone 'Europe/Madrid')),'[]'); end $$;

create or replace function public.enable_mobile_auditor(p_user_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare old public.auditor_devices%rowtype; begin
 if not public.admin_has_role(array['owner','supervisor']) then raise exception 'ADMIN_ROLE_ACCESS_DENIED'; end if;
 select * into old from public.auditor_devices where user_id=p_user_id for update;
 if old.user_id is null or not public.admin_can_access_zone(old.zone) then raise exception 'ADMIN_ZONE_ACCESS_DENIED'; end if;
 update public.auditor_devices set active=true,updated_at=clock_timestamp() where user_id=p_user_id;
 insert into public.auditor_access_history(user_id,actor_user_id,action,old_profile,new_profile) values(p_user_id,auth.uid(),'enable',to_jsonb(old),null);
 return true;
end $$;

create or replace function public.leave_mobile_auditor()
returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform app_private.require_mobile_auditor();
 if exists(select 1 from public.auditor_audit_drafts where user_id=auth.uid() and submitted_at is null)
 or exists(select 1 from public.auditor_material_drafts d cross join lateral jsonb_each_text(d.materials)m where d.user_id=auth.uid() and m.value::numeric>0)
 then raise exception 'AUDITOR_PENDING_WORK'; end if;
 update public.auditor_devices set active=false,updated_at=clock_timestamp() where user_id=auth.uid();
 return true;
end $$;

do $$ declare n text; s text; begin
 foreach n in array array['get_my_auditor_profile','get_auditor_warehouse_options','authorize_mobile_auditor','begin_mobile_auditor_audit','save_mobile_auditor_draft','get_my_auditor_pending_audits','submit_mobile_auditor_audit','save_mobile_auditor_materials','get_my_auditor_materials','get_my_auditor_material_options','get_my_auditor_consumption','submit_mobile_auditor_consumption','list_mobile_auditors','revoke_mobile_auditor','enable_mobile_auditor','leave_mobile_auditor','get_auditor_consumption_report'] loop
 for s in select p.oid::regprocedure::text from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname='public' and p.proname=n loop
 execute 'revoke all on function '||s||' from public,anon';
 execute 'grant execute on function '||s||' to authenticated';
 end loop; end loop;
end $$;
commit;
