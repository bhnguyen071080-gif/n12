begin;
-- Operating hours retain the Phase 2 semantics: actual machine runtime only.
comment on table public.monthly_operating_hours is 'Tổng giờ hoạt động thực tế của PTTB trong tháng; không gồm thời gian hư hỏng/dừng máy';
alter table public.monthly_production alter column teu drop not null;
comment on table public.monthly_production is 'Sản lượng container theo PTTB/tháng: Boxes và TEU, không lưu hàng khác';
create type public.cargo_unit as enum ('TONNE','M3','ITEM','TRIP');
create type public.cause_group as enum ('ELECTRICAL_PLC','HYDRAULICS_SPREADER','MECHANICAL_CABLE','ENGINE_DRIVE','UNCLASSIFIED');
create table public.cargo_types (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id),
 code text not null,name text not null,unit public.cargo_unit not null,unique(workspace_id,code)
);
create table public.monthly_other_cargo (
 id uuid primary key default gen_random_uuid(),equipment_id uuid not null references public.equipment(id),
 cargo_type_id uuid not null references public.cargo_types(id),
 month date not null check(extract(day from month)=1),quantity numeric(18,3) not null check(quantity>=0),
 updated_by uuid not null default auth.uid() references auth.users(id),updated_at timestamptz not null default now(),
 unique(equipment_id,cargo_type_id,month)
);
comment on table public.monthly_other_cargo is 'Sản lượng hàng khác: từng PTTB/tháng/loại hàng; đơn vị nằm ở cargo_types, không quy đổi tự động sang TEU';
create index other_cargo_type_idx on public.monthly_other_cargo(cargo_type_id);
create function private.guard_other_cargo() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.equipment e join public.cargo_types c on c.workspace_id=e.workspace_id
 where e.id=new.equipment_id and c.id=new.cargo_type_id) then
  raise exception using errcode='22023',message='Loại hàng không cùng không gian dữ liệu'; end if;
 if tg_op='UPDATE' and row(new.id,new.equipment_id,new.cargo_type_id,new.month) is distinct from row(old.id,old.equipment_id,old.cargo_type_id,old.month) then
  raise exception using errcode='42501',message='Không được chuyển định danh dòng sản lượng hàng khác'; end if;
 new.updated_by:=auth.uid();new.updated_at:=now(); return new;
end; $$;
create trigger other_cargo_guard before insert or update on public.monthly_other_cargo for each row execute function private.guard_other_cargo();

create table public.equipment_teams (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id),
 code text not null,name text not null,unique(workspace_id,code)
);
alter table public.equipment add column team_id uuid references public.equipment_teams(id);
create index equipment_team_idx on public.equipment(team_id);
create function private.guard_equipment_team() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.team_id is not null and not exists(select 1 from public.equipment_teams t where t.id=new.team_id and t.workspace_id=new.workspace_id) then
  raise exception using errcode='22023',message='Đội quản lý khác không gian dữ liệu'; end if; return new;
end; $$;
create trigger equipment_team_guard before insert or update on public.equipment for each row execute function private.guard_equipment_team();
create trigger team_identity before update on public.equipment_teams for each row execute function private.guard_catalogue_identity();
create trigger cargo_identity before update on public.cargo_types for each row execute function private.guard_catalogue_identity();

alter table public.repair_work_items add column root_cause_group public.cause_group not null default 'UNCLASSIFIED';
-- A separate invoker guard protects the new technical column against supply-role edits.
create function private.guard_cause_group() returns trigger language plpgsql set search_path='' as $$
begin
 if (tg_op='INSERT' and new.root_cause_group<>'UNCLASSIFIED') or
 (tg_op='UPDATE' and new.root_cause_group is distinct from old.root_cause_group) then
  if not private.can_order(new.repair_order_id,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then
   raise exception using errcode='42501',message='Nhóm nguyên nhân là nội dung kỹ thuật'; end if;
  if tg_op='UPDATE' and old.acceptance_status='accepted' and not private.can_order(new.repair_order_id,array['TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then
   raise exception using errcode='22023',message='Phải mở lại nghiệm thu trước khi đổi nhóm nguyên nhân'; end if;
 end if; return new;
end; $$;
create trigger cause_group_guard before insert or update on public.repair_work_items for each row execute function private.guard_cause_group();

alter table public.repair_material_usages add column unit_cost_vnd numeric(18,2) check(unit_cost_vnd>=0);
comment on column public.repair_material_usages.unit_cost_vnd is 'Đơn giá tại lần sử dụng, VND; NULL=chưa định giá, không dùng giá danh mục hiện tại';
-- Preserve the original role and dossier guard, but accept actual installation time.
create or replace function private.guard_material_usage()
returns trigger language plpgsql security definer set search_path='' as $$
declare item public.repair_work_items; r public.repair_orders; w uuid;
begin
 select * into strict item from public.repair_work_items where id=new.repair_work_item_id;
 select * into strict r from public.repair_orders where id=item.repair_order_id for update;
 select workspace_id into strict w from public.equipment where id=r.equipment_id;
 if not exists(select 1 from public.materials where id=new.material_id and workspace_id=w) then
  raise exception using errcode='22023',message='Vật tư khác workspace';
 end if;
 if r.closed_at is not null or r.cancelled_at is not null or item.dossier_status='closed' then
  raise exception using errcode='22023',message='Hồ sơ/hạng mục đã đóng';
 end if;
 if tg_op='UPDATE' and (new.id<>old.id or new.material_id<>old.material_id or new.repair_work_item_id<>old.repair_work_item_id) then
  raise exception using errcode='42501',message='Không được thay đổi liên kết vật tư';
 end if;
 if new.document_status in ('installed','documents_complete') then
  new.installed_at:=coalesce(case when tg_op='UPDATE' then old.installed_at end,new.installed_at,now());
 else new.installed_at:=null; end if;
 if new.document_status='documents_complete' and (
  new.returned_quantity<new.borrowed_quantity or
  coalesce((select -sum(l.quantity_delta) from public.voucher_lines l where l.usage_id=new.id),0)<>new.quantity
 ) then raise exception using errcode='22023',message='Còn khoản vay hoặc chưa có phiếu lĩnh'; end if;
 return new;
end; $$;

create function private.guard_material_cost() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and old.document_status='documents_complete' and row(new.unit_cost_vnd,new.quantity,new.installed_at)
 is distinct from row(old.unit_cost_vnd,old.quantity,old.installed_at) and
 not private.can_item(new.repair_work_item_id,array['TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then
  raise exception using errcode='42501',message='Chỉ trưởng bộ phận được hiệu chỉnh giá/lượng sau tất toán'; end if;
 return new;
end; $$;
create trigger zz_cost_guard before insert or update on public.repair_material_usages for each row execute function private.guard_material_cost();

create table public.failure_incidents (
 id uuid primary key default gen_random_uuid(),equipment_id uuid not null references public.equipment(id),
 repair_order_id uuid not null references public.repair_orders(id),
 occurred_at timestamptz not null,restored_at timestamptz,
 confirmed boolean not null default false,primary_cause_group public.cause_group not null default 'UNCLASSIFIED',
 created_by uuid not null default auth.uid() references auth.users(id),
 check(restored_at is null or restored_at>=occurred_at)
);
create index failure_equipment_time_idx on public.failure_incidents(equipment_id,occurred_at);
create index failure_order_idx on public.failure_incidents(repair_order_id);
alter table public.equipment_downtimes add column failure_incident_id uuid references public.failure_incidents(id);
alter table public.equipment_downtimes add column downtime_kind text not null default 'unclassified'
 check(downtime_kind in ('failure','planned','other','unclassified'));
alter table public.equipment_downtimes add constraint downtime_failure_link check(
 (downtime_kind='failure')=(failure_incident_id is not null));
create index downtime_incident_idx on public.equipment_downtimes(failure_incident_id);
create index downtime_equipment_time_idx on public.equipment_downtimes(equipment_id,started_at);
create function private.guard_failure() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.repair_orders r where r.id=new.repair_order_id and r.equipment_id=new.equipment_id) then
  raise exception using errcode='22023',message='Sự cố không cùng PTTB với hồ sơ'; end if;
 if tg_op='INSERT' then new.created_by:=auth.uid();
 elsif row(new.id,new.equipment_id,new.repair_order_id,new.created_by,new.occurred_at)
 is distinct from row(old.id,old.equipment_id,old.repair_order_id,old.created_by,old.occurred_at) then
  raise exception using errcode='42501',message='Không được chuyển định danh sự cố'; end if;
 if new.restored_at is not null and exists(select 1 from public.equipment_downtimes d where d.failure_incident_id=new.id
  and (d.ended_at is null or d.ended_at>new.restored_at)) then
  raise exception using errcode='22023',message='Phải kết thúc các khoảng dừng trước khi khôi phục sự cố'; end if;
 return new;
end; $$;
create trigger failure_guard before insert or update on public.failure_incidents for each row execute function private.guard_failure();
create function private.guard_failure_downtime() returns trigger language plpgsql security definer set search_path='' as $$
declare inc public.failure_incidents;
begin
 if tg_op='UPDATE' and old.failure_incident_id is not null and new.failure_incident_id is distinct from old.failure_incident_id then
  raise exception using errcode='42501',message='Không được chuyển khoảng dừng sang sự cố khác'; end if;
 if new.failure_incident_id is not null then
  select * into strict inc from public.failure_incidents where id=new.failure_incident_id for update;
  if inc.equipment_id<>new.equipment_id or inc.repair_order_id is distinct from new.repair_order_id
   or new.started_at<inc.occurred_at or (inc.restored_at is not null and (new.ended_at is null or new.ended_at>inc.restored_at)) then
   raise exception using errcode='22023',message='Khoảng dừng không khớp sự cố hoặc thời gian thực tế'; end if;
 end if; return new;
end; $$;
create trigger failure_downtime_guard before insert or update on public.equipment_downtimes for each row execute function private.guard_failure_downtime();

create table public.equipment_life_items (
 id uuid primary key default gen_random_uuid(),equipment_id uuid not null references public.equipment(id),
 slot_code text not null,name text not null,
 component_kind text not null check(component_kind in ('CABLE','CRANE_FRAME_HAMMER','OTHER')),
 installed_at timestamptz not null,installed_meter_hours numeric(18,2) not null check(installed_meter_hours>=0),
 limit_hours numeric(18,2) not null check(limit_hours>0),warning_hours numeric(18,2) not null default 25 check(warning_hours>=0),
 usage_id uuid unique references public.repair_material_usages(id),
 retired_at timestamptz,check(retired_at is null or retired_at>=installed_at)
);
create unique index active_life_slot on public.equipment_life_items(equipment_id,slot_code) where retired_at is null;
create index life_usage_idx on public.equipment_life_items(usage_id);
create function private.guard_life_item() returns trigger language plpgsql security definer set search_path='' as $$
declare h numeric;
begin
 select accumulated_hours into strict h from public.equipment where id=new.equipment_id for update;
 if new.installed_meter_hours>h then raise exception using errcode='22023',message='Mốc giờ lắp không được vượt giờ lũy kế'; end if;
 if new.usage_id is not null and not exists(select 1 from public.repair_material_usages u join public.repair_work_items i on i.id=u.repair_work_item_id
 join public.repair_orders r on r.id=i.repair_order_id where u.id=new.usage_id and r.equipment_id=new.equipment_id
 and u.document_status in ('installed','documents_complete')) then
  raise exception using errcode='22023',message='Vật tư lắp không khớp PTTB'; end if;
 if tg_op='UPDATE' and row(new.id,new.equipment_id,new.slot_code,new.usage_id,new.installed_meter_hours,new.installed_at)
 is distinct from row(old.id,old.equipment_id,old.slot_code,old.usage_id,old.installed_meter_hours,old.installed_at) then
  raise exception using errcode='42501',message='Mốc lắp/định danh là bất biến; tạo lần thay mới'; end if;
 return new;
end; $$;
create trigger life_guard before insert or update on public.equipment_life_items for each row execute function private.guard_life_item();

do $$ declare t text; begin
 foreach t in array array['cargo_types','monthly_other_cargo','equipment_teams','failure_incidents','equipment_life_items'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create trigger audit_row after insert or update or delete on public.%I for each row execute function private.audit_change()',t);
 end loop;
 foreach t in array array['cargo_types','equipment_teams'] loop
  execute format('create policy catalogue_read on public.%I for select to authenticated using(private.has_role(workspace_id,enum_range(null::public.eam_role)))',t);
  execute format('create policy catalogue_insert on public.%I for insert to authenticated with check(private.has_role(workspace_id,array[''TRUONG_BO_PHAN_KY_THUAT'']::public.eam_role[]))',t);
  execute format('create policy catalogue_update on public.%I for update to authenticated using(private.has_role(workspace_id,array[''TRUONG_BO_PHAN_KY_THUAT'']::public.eam_role[])) with check(private.has_role(workspace_id,array[''TRUONG_BO_PHAN_KY_THUAT'']::public.eam_role[]))',t);
  execute format('grant insert,update on public.%I to authenticated',t);
 end loop;
 foreach t in array array['monthly_other_cargo','failure_incidents','equipment_life_items'] loop
  execute format('create policy technical_read on public.%I for select to authenticated using(private.can_equipment(equipment_id,array[''KY_THUAT_VIEN'',''TRUONG_BO_PHAN_KY_THUAT'']::public.eam_role[]))',t);
  execute format('create policy technical_insert on public.%I for insert to authenticated with check(private.can_equipment(equipment_id,array[''KY_THUAT_VIEN'',''TRUONG_BO_PHAN_KY_THUAT'']::public.eam_role[]))',t);
  execute format('create policy technical_update on public.%I for update to authenticated using(private.can_equipment(equipment_id,array[''KY_THUAT_VIEN'',''TRUONG_BO_PHAN_KY_THUAT'']::public.eam_role[])) with check(private.can_equipment(equipment_id,array[''KY_THUAT_VIEN'',''TRUONG_BO_PHAN_KY_THUAT'']::public.eam_role[]))',t);
  execute format('grant insert,update on public.%I to authenticated',t);
 end loop;
end; $$;
create policy other_cargo_delete on public.monthly_other_cargo for delete to authenticated using(private.can_equipment(equipment_id,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]));
grant delete on public.monthly_other_cargo to authenticated;

create function private.import_split(p_workspace uuid,p_kind text,p_rows jsonb,p_key uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare fp text; prior private.import_requests; n integer;
begin
 if not private.has_role(p_workspace,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then
  raise exception using errcode='42501',message='Không có quyền nhập số liệu tháng'; end if;
 if p_kind not in ('hours','container','other') or p_key is null or p_rows is null or jsonb_typeof(p_rows)<>'array'
 or jsonb_array_length(p_rows) not between 1 and 1000 then
  raise exception using errcode='22023',message='Loại import hoặc số dòng không hợp lệ'; end if;
 perform 1 from public.workspaces where id=p_workspace for update;
 fp:=md5(jsonb_build_array(p_kind,p_rows)::text);
 select * into prior from private.import_requests where workspace_id=p_workspace and request_key=p_key;
 if found then
  if prior.actor_id<>auth.uid() or prior.fingerprint<>fp then raise exception using errcode='22023',message='Khóa import đã dùng cho dữ liệu khác'; end if;
  return prior.row_count;
 end if;
 if exists(select 1 from jsonb_to_recordset(p_rows) as r(equipment_code text,month date) where r.month is null
 or extract(day from r.month)<>1 or r.equipment_code is null or not exists(select 1 from public.equipment e where e.workspace_id=p_workspace and e.code=r.equipment_code)) then
  raise exception using errcode='22023',message='Sai phương tiện hoặc tháng'; end if;
 if p_kind='other' then
  if exists(select 1 from jsonb_to_recordset(p_rows) as r(equipment_code text,month date,cargo_code text,quantity numeric)
  where r.quantity is null or r.quantity<0 or not exists(select 1 from public.cargo_types c where c.workspace_id=p_workspace and c.code=r.cargo_code))
  or exists(select 1 from jsonb_to_recordset(p_rows) as r(equipment_code text,month date,cargo_code text)
   group by equipment_code,month,cargo_code having count(*)>1) then
   raise exception using errcode='22023',message='Sai loại hàng, số lượng hoặc trùng dòng'; end if;
 else
  if exists(select 1 from jsonb_to_recordset(p_rows) as r(equipment_code text,month date)
   group by equipment_code,month having count(*)>1) then raise exception using errcode='22023',message='Trùng PTTB/tháng'; end if;
 end if;
 perform 1 from public.equipment where workspace_id=p_workspace and code in(
  select equipment_code from jsonb_to_recordset(p_rows) as r(equipment_code text)) order by id for update;
 if p_kind='hours' then
  if exists(select 1 from jsonb_to_recordset(p_rows) as r(operating_hours numeric) where operating_hours is null or operating_hours<0) then
   raise exception using errcode='22023',message='Thiếu hoặc sai tổng giờ hoạt động'; end if;
  insert into public.monthly_operating_hours(equipment_id,month,operating_hours)
  select e.id,r.month,r.operating_hours from jsonb_to_recordset(p_rows) as r(equipment_code text,month date,operating_hours numeric)
  join public.equipment e on e.workspace_id=p_workspace and e.code=r.equipment_code
  on conflict(equipment_id,month) do update set operating_hours=excluded.operating_hours;
 elsif p_kind='container' then
  if exists(select 1 from jsonb_to_recordset(p_rows) as r(boxes bigint,teu numeric) where boxes is null or boxes<0 or (teu is not null and teu<0)) then
   raise exception using errcode='22023',message='Thiếu hoặc sai Boxes/TEU'; end if;
  insert into public.monthly_production(equipment_id,month,boxes,teu)
  select e.id,r.month,r.boxes,r.teu from jsonb_to_recordset(p_rows) as r(equipment_code text,month date,boxes bigint,teu numeric)
  join public.equipment e on e.workspace_id=p_workspace and e.code=r.equipment_code
  on conflict(equipment_id,month) do update set boxes=excluded.boxes,teu=coalesce(excluded.teu,public.monthly_production.teu);
 else
  insert into public.monthly_other_cargo(equipment_id,cargo_type_id,month,quantity)
  select e.id,c.id,r.month,r.quantity from jsonb_to_recordset(p_rows) as r(equipment_code text,cargo_code text,month date,quantity numeric)
  join public.equipment e on e.workspace_id=p_workspace and e.code=r.equipment_code
  join public.cargo_types c on c.workspace_id=p_workspace and c.code=r.cargo_code
  on conflict(equipment_id,cargo_type_id,month) do update set quantity=excluded.quantity;
 end if;
 n:=jsonb_array_length(p_rows);
 insert into private.import_requests values(p_workspace,p_key,auth.uid(),fp,n); return n;
end; $$;
create function public.import_operating_months(p_workspace uuid,p_rows jsonb,p_key uuid) returns integer language sql security invoker set search_path='' as $$select private.import_split(p_workspace,'hours',p_rows,p_key)$$;
create function public.import_container_months(p_workspace uuid,p_rows jsonb,p_key uuid) returns integer language sql security invoker set search_path='' as $$select private.import_split(p_workspace,'container',p_rows,p_key)$$;
create function public.import_other_cargo_months(p_workspace uuid,p_rows jsonb,p_key uuid) returns integer language sql security invoker set search_path='' as $$select private.import_split(p_workspace,'other',p_rows,p_key)$$;

create function private.validate_report_period(p_workspace uuid,p_from date,p_to date)
returns boolean language plpgsql stable set search_path='' as $$
begin
 if not private.has_role(p_workspace,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then
  raise exception using errcode='42501',message='Không có quyền báo cáo kỹ thuật'; end if;
 if p_from is null or p_to is null or p_to<=p_from or extract(day from p_from)<>1 or extract(day from p_to)<>1 or p_to>p_from+interval '3 years' then
  raise exception using errcode='22023',message='Chọn kỳ trọn tháng, tối đa 36 tháng, ngày kết thúc loại trừ'; end if;
 return true;
end; $$;
create function public.report_reliability(p_workspace uuid,p_from date,p_to date)
returns table(equipment_id uuid,equipment_code text,team_id uuid,runtime_hours numeric,failure_downtime_hours numeric,
 failure_count bigint,mttr_hours numeric,mtbf_hours numeric,availability_pct numeric,
 missing_hour_months integer,open_failures bigint,carry_in_failures bigint,unclassified_downtime_hours numeric)
language sql stable security invoker set search_path='' as $$
with bounds as(
 select p_from::timestamp at time zone 'Asia/Bangkok' as lo,
 least(p_to::timestamp at time zone 'Asia/Bangkok',now()) as hi,
 (extract(year from age(p_to,p_from))*12+extract(month from age(p_to,p_from)))::integer as months
 where private.validate_report_period(p_workspace,p_from,p_to)
), measures as (
 select e.id,e.code,e.team_id,
 (select sum(h.operating_hours) from public.monthly_operating_hours h where h.equipment_id=e.id and h.month>=p_from and h.month<p_to) as run,
 b.months-(select count(*)::integer from public.monthly_operating_hours h where h.equipment_id=e.id and h.month>=p_from and h.month<p_to) as missing,
 (select count(*) from public.failure_incidents i where i.equipment_id=e.id and i.confirmed and i.occurred_at>=b.lo and i.occurred_at<b.hi) as failures,
 (select count(*) from public.failure_incidents i where i.equipment_id=e.id and i.confirmed and i.occurred_at<b.hi and (i.restored_at is null or i.restored_at>b.hi)) as open_n,
 (select count(*) from public.failure_incidents i where i.equipment_id=e.id and i.confirmed and i.occurred_at<b.lo and (i.restored_at is null or i.restored_at>b.lo)) as carry_n,
 coalesce(fd.hours,0) as down,coalesce(ud.hours,0) as unknown_down
 from public.equipment e cross join bounds b
 left join lateral (
  select sum(extract(epoch from upper(part)-lower(part))/3600)::numeric as hours
  from unnest((select range_agg(tstzrange(greatest(d.started_at,b.lo),least(coalesce(d.ended_at,now()),b.hi),'[)'))
   from public.equipment_downtimes d join public.failure_incidents i on i.id=d.failure_incident_id
   where d.equipment_id=e.id and d.downtime_kind='failure' and i.confirmed
   and d.started_at<b.hi and coalesce(d.ended_at,now())>b.lo)) part
 ) fd on true
 left join lateral (
  select sum(extract(epoch from upper(part)-lower(part))/3600)::numeric as hours
  from unnest((select range_agg(tstzrange(greatest(d.started_at,b.lo),least(coalesce(d.ended_at,now()),b.hi),'[)'))
   from public.equipment_downtimes d where d.equipment_id=e.id and d.downtime_kind='unclassified'
   and d.started_at<b.hi and coalesce(d.ended_at,now())>b.lo)) part
 ) ud on true
 where e.workspace_id=p_workspace
)
select id,code,team_id,run,down,failures,down/nullif(failures,0),
 case when missing=0 then run/nullif(failures,0) end,
 case when missing=0 then 100*run/nullif(run+down,0) end,
 missing,open_n,carry_n,unknown_down from measures;
$$;
create function public.report_material_costs(p_workspace uuid,p_from date,p_to date)
returns table(equipment_id uuid,equipment_code text,known_cost_vnd numeric,unpriced_usages bigint,container_teu numeric,
 missing_container_months integer,cost_per_1000_teu_vnd numeric)
language sql stable security invoker set search_path='' as $$
with b as(select true ok where private.validate_report_period(p_workspace,p_from,p_to)), m as(
 select e.id,e.code,
 coalesce((select sum(u.quantity*u.unit_cost_vnd) from public.repair_material_usages u
 join public.repair_work_items i on i.id=u.repair_work_item_id join public.repair_orders r on r.id=i.repair_order_id
 where r.equipment_id=e.id and u.installed_at>=p_from::timestamp at time zone 'Asia/Bangkok'
 and u.installed_at<p_to::timestamp at time zone 'Asia/Bangkok'),0) as cost,
 (select count(*) from public.repair_material_usages u join public.repair_work_items i on i.id=u.repair_work_item_id
 join public.repair_orders r on r.id=i.repair_order_id where r.equipment_id=e.id and u.installed_at>=p_from::timestamp at time zone 'Asia/Bangkok'
 and u.installed_at<p_to::timestamp at time zone 'Asia/Bangkok' and u.unit_cost_vnd is null) as unpriced,
 (select sum(p.teu) from public.monthly_production p where p.equipment_id=e.id and p.month>=p_from and p.month<p_to) as teu,
 (extract(year from age(p_to,p_from))*12+extract(month from age(p_to,p_from)))::integer-
 (select count(*)::integer from public.monthly_production p where p.equipment_id=e.id and p.month>=p_from and p.month<p_to and p.teu is not null) as missing
 from public.equipment e cross join b where e.workspace_id=p_workspace
)
select id,code,cost,unpriced,teu,missing,case when missing=0 and unpriced=0 then cost*1000/nullif(teu,0) end from m;
$$;
create function public.report_failure_causes(p_workspace uuid,p_from date,p_to date)
returns table(cause public.cause_group,incident_count bigint,percentage numeric)
language sql stable security invoker set search_path='' as $$
with b as(select true ok where private.validate_report_period(p_workspace,p_from,p_to)),
counts as(
 select g as cause,count(i.id) as n from unnest(enum_range(null::public.cause_group)) g cross join b
 left join public.failure_incidents i on i.primary_cause_group=g and i.confirmed
 and i.occurred_at>=p_from::timestamp at time zone 'Asia/Bangkok' and i.occurred_at<p_to::timestamp at time zone 'Asia/Bangkok'
 and exists(select 1 from public.equipment e where e.id=i.equipment_id and e.workspace_id=p_workspace)
 group by g
)
select cause,n,n*100.0/nullif(sum(n) over(),0) from counts;
$$;

create view public.vw_technical_backlog with(security_invoker=true) as
select e.workspace_id,e.id as equipment_id,e.code as equipment_code,e.status as equipment_status,
 r.code as order_code,i.id as item_id,i.symptom,i.execution_status,i.material_status
from public.equipment e join public.repair_orders r on r.equipment_id=e.id join public.repair_work_items i on i.repair_order_id=r.id
where r.closed_at is null and r.cancelled_at is null and i.execution_status<>'completed'
 and private.can_equipment(e.id,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]);
create view public.vw_procedural_backlog with(security_invoker=true) as
select e.workspace_id,e.id as equipment_id,e.code as equipment_code,e.status as equipment_status,
 r.code as order_code,i.id as item_id,i.symptom,i.material_status,i.requisition_status,i.dossier_status,
 coalesce((select sum(u.borrowed_quantity-u.returned_quantity) from public.repair_material_usages u where u.repair_work_item_id=i.id),0) as borrowed_quantity_outstanding,
 (select count(*) from public.repair_material_usages u where u.repair_work_item_id=i.id and u.document_status<>'documents_complete') as unsettled_material_lines
from public.equipment e join public.repair_orders r on r.equipment_id=e.id join public.repair_work_items i on i.repair_order_id=r.id
where r.closed_at is null and r.cancelled_at is null and e.status='available' and i.execution_status='completed'
 and (i.material_status='borrowed' or i.requisition_status='temporary_issue_debt' or i.dossier_status<>'closed'
 or exists(select 1 from public.repair_material_usages u where u.repair_work_item_id=i.id and (u.returned_quantity<u.borrowed_quantity or u.document_status<>'documents_complete')))
 and private.can_equipment(e.id,array['KY_THUAT_VIEN','CAN_BO_VAT_TU','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]);
create view public.vw_other_cargo_monthly with(security_invoker=true) as
select e.workspace_id,e.code as equipment_code,p.month,c.code as cargo_code,c.name as cargo_name,c.unit,p.quantity
from public.monthly_other_cargo p join public.equipment e on e.id=p.equipment_id join public.cargo_types c on c.id=p.cargo_type_id;
create view public.vw_component_life with(security_invoker=true) as
select e.workspace_id,e.code as equipment_code,l.*,e.accumulated_hours,
 e.accumulated_hours-l.installed_meter_hours as used_hours,
 l.limit_hours-(e.accumulated_hours-l.installed_meter_hours) as remaining_hours,
 case when e.accumulated_hours<l.installed_meter_hours then 'invalid_meter'
 when e.accumulated_hours-l.installed_meter_hours>=l.limit_hours then 'overdue'
 when e.accumulated_hours-l.installed_meter_hours>=l.limit_hours-l.warning_hours then 'due_soon' else 'normal' end as alert_level
from public.equipment_life_items l join public.equipment e on e.id=l.equipment_id where l.retired_at is null;

-- Quick report creates a case/order once, then an UNCONFIRMED fault for diagnosis.
create function private.quick_fault(p_equipment uuid,p_when timestamptz,p_symptom text,p_stopped boolean,p_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid; oid uuid; iid uuid;
begin
 if p_stopped is null then raise exception using errcode='22023',message='Phải chọn tình trạng dừng máy'; end if;
 -- Include stop flag in the case fingerprint to reject inconsistent retries.
 cid:=private.create_case(p_equipment,'repair',p_when,null,p_symptom,p_key);
 select id into strict oid from public.repair_orders where case_id=cid;
 select id into iid from public.failure_incidents where repair_order_id=oid;
 if found then
  if exists(select 1 from public.equipment_downtimes d where d.failure_incident_id=iid)<>p_stopped then
   raise exception using errcode='22023',message='Lần gửi lại khác tình trạng dừng máy'; end if;
  return oid;
 end if;
 insert into public.failure_incidents(equipment_id,repair_order_id,occurred_at)
 values(p_equipment,oid,p_when) returning id into iid;
 if p_stopped then
  insert into public.equipment_downtimes(equipment_id,repair_order_id,started_at,failure_incident_id,downtime_kind)
  values(p_equipment,oid,p_when,iid,'failure');
 end if; return oid;
end; $$;
create function public.report_equipment_fault(p_equipment uuid,p_when timestamptz,p_symptom text,p_stopped boolean,p_key uuid)
returns uuid language sql security invoker set search_path='' as $$select private.quick_fault(p_equipment,p_when,p_symptom,p_stopped,p_key)$$;

revoke execute on function private.import_split(uuid,text,jsonb,uuid),private.validate_report_period(uuid,date,date),
 private.quick_fault(uuid,timestamptz,text,boolean,uuid) from public,anon;
grant execute on function private.import_split(uuid,text,jsonb,uuid),private.validate_report_period(uuid,date,date),
 private.quick_fault(uuid,timestamptz,text,boolean,uuid) to authenticated;
revoke execute on function public.import_operating_months(uuid,jsonb,uuid),public.import_container_months(uuid,jsonb,uuid),
 public.import_other_cargo_months(uuid,jsonb,uuid),public.report_reliability(uuid,date,date),public.report_material_costs(uuid,date,date),
 public.report_failure_causes(uuid,date,date),public.report_equipment_fault(uuid,timestamptz,text,boolean,uuid) from public,anon;
grant execute on function public.import_operating_months(uuid,jsonb,uuid),public.import_container_months(uuid,jsonb,uuid),
 public.import_other_cargo_months(uuid,jsonb,uuid),public.report_reliability(uuid,date,date),public.report_material_costs(uuid,date,date),
 public.report_failure_causes(uuid,date,date),public.report_equipment_fault(uuid,timestamptz,text,boolean,uuid) to authenticated;
revoke all on public.vw_technical_backlog,public.vw_procedural_backlog,public.vw_other_cargo_monthly,public.vw_component_life from public,anon;
grant select on public.vw_technical_backlog,public.vw_procedural_backlog,public.vw_other_cargo_monthly,public.vw_component_life to authenticated;

create function private.guard_cargo_unit() returns trigger language plpgsql set search_path='' as $$
begin
 if new.unit<>old.unit then raise exception using errcode='42501',message='Đơn vị hàng là bất biến; tạo loại hàng mới nếu cần đổi'; end if;
 return new;
end; $$;
create trigger cargo_unit_guard before update on public.cargo_types for each row execute function private.guard_cargo_unit();
create function private.quick_inspection(p_equipment uuid,p_when timestamptz,p_notes text,p_abnormal boolean,p_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid; c public.work_cases; existing public.case_checks;
begin
 if p_abnormal is null or p_notes is null or length(btrim(p_notes))=0 then
  raise exception using errcode='22023',message='Phải có kết quả kiểm tra'; end if;
 cid:=private.create_case(p_equipment,'inspection',p_when,null,p_notes,p_key);
 select * into strict c from public.work_cases where id=cid for update;
 select * into existing from public.case_checks where case_id=cid and item_no=1;
 if found then
  if existing.abnormal<>p_abnormal or existing.notes<>p_notes then
   raise exception using errcode='22023',message='Lần gửi lại khác kết quả kiểm tra'; end if;
 else
  insert into public.case_checks(case_id,item_no,label,abnormal,notes) values(cid,1,'Kiểm tra nhanh đầu ca',p_abnormal,p_notes);
 end if;
 if c.submitted_at is null then update public.work_cases set submitted_at=now() where id=cid; end if;
 return cid;
end; $$;
create function public.submit_quick_inspection(p_equipment uuid,p_when timestamptz,p_notes text,p_abnormal boolean,p_key uuid)
returns uuid language sql security invoker set search_path='' as $$select private.quick_inspection(p_equipment,p_when,p_notes,p_abnormal,p_key)$$;
revoke execute on function private.quick_inspection(uuid,timestamptz,text,boolean,uuid),
 public.submit_quick_inspection(uuid,timestamptz,text,boolean,uuid) from public,anon;
grant execute on function private.quick_inspection(uuid,timestamptz,text,boolean,uuid),
 public.submit_quick_inspection(uuid,timestamptz,text,boolean,uuid) to authenticated;

commit;
