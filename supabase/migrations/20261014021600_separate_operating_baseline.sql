begin;
set local lock_timeout='5s';
-- Unknown is NULL, never an invented zero. Existing numeric baselines are retained.
alter table public.equipment
 alter column initial_hours drop not null, alter column initial_hours drop default,
 alter column accumulated_hours drop not null, alter column accumulated_hours drop default,
 add column hours_start_month date check(hours_start_month between date '2000-01-01' and date '2199-12-01' and extract(day from hours_start_month)=1),
 add column hours_baseline_key uuid,
 add column hours_confirmed_by uuid references auth.users(id),
 add column hours_confirmed_at timestamptz,
 add constraint equipment_hours_baseline_check check(
  (hours_start_month is null and hours_baseline_key is null and hours_confirmed_by is null and hours_confirmed_at is null)
  or (initial_hours is not null and hours_start_month is not null and hours_baseline_key is not null and hours_confirmed_by is not null and hours_confirmed_at is not null)),
 add constraint equipment_unknown_hours_check check((initial_hours is null)=(accumulated_hours is null));
create index equipment_hours_confirmer_idx on public.equipment(hours_confirmed_by) where hours_confirmed_by is not null;

create or replace function private.guard_equipment() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then new.accumulated_hours:=new.initial_hours;
 else
  if new.id<>old.id or new.workspace_id<>old.workspace_id or new.code<>old.code then
   raise exception using errcode='42501',message='Không được thay đổi định danh PTTB';
  end if;
  if new.accumulated_hours is distinct from old.accumulated_hours and current_user<>'postgres' then
   raise exception using errcode='42501',message='Giờ lũy kế chỉ được cập nhật từ số liệu tháng';
  end if;
  if old.hours_start_month is not null and row(new.initial_hours,new.hours_start_month,new.hours_baseline_key,new.hours_confirmed_by,new.hours_confirmed_at)
   is distinct from row(old.initial_hours,old.hours_start_month,old.hours_baseline_key,old.hours_confirmed_by,old.hours_confirmed_at) then
   raise exception using errcode='22023',message='Mốc giờ đã xác nhận được giữ nguyên; không chỉnh lại trong danh mục';
  end if;
  if old.initial_hours is not null and new.initial_hours is distinct from old.initial_hours then
   raise exception using errcode='22023',message='Không đổi giờ gốc đã lưu';
  end if;
  if new.initial_hours is distinct from old.initial_hours then
   if new.hours_start_month is null then raise exception using errcode='22023',message='Cần xác nhận tháng bắt đầu cùng giờ gốc';end if;
   new.accumulated_hours:=new.initial_hours+coalesce((select sum(h.operating_hours) from public.monthly_operating_hours h where h.equipment_id=new.id),0);
  end if;
 end if;
 if new.hours_start_month is not null then
  if (tg_op='INSERT' or old.hours_start_month is null) and
    (auth.uid() is null or new.hours_confirmed_by is distinct from auth.uid()) then
   raise exception using errcode='42501',message='Người xác nhận mốc giờ phải là tài khoản đang đăng nhập';
  end if;
  if exists(select 1 from public.monthly_operating_hours h where h.equipment_id=new.id and h.month<new.hours_start_month) then
   raise exception using errcode='22023',message='Đã có giờ tháng trước mốc; cần đối chiếu để tránh cộng trùng';
  end if;
 end if;
 return new;
end; $$;

-- Separate catalog API: no hours parameter, and no write to an existing baseline.
-- Keep the older explicit-hours signature for clients already open during rollout.
create function public.save_equipment_catalog(
 p_workspace uuid,p_id uuid,p_version integer,p_key uuid,p_code text,p_name text,p_category text,
 p_base_status text,p_serial text,p_year integer,p_notes text,p_aliases text[])
returns uuid language plpgsql security invoker set search_path='' as $$
declare e public.equipment; saved_id uuid; same_data boolean;
begin
 if auth.uid() is null or not private.has_role(p_workspace,array['TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then
  raise exception using errcode='42501',message='Chỉ người quản lý khu vực được lưu danh mục';
 end if;
 p_code:=upper(btrim(p_code));p_name:=btrim(p_name);p_serial:=nullif(btrim(p_serial),'');p_notes:=coalesce(btrim(p_notes),'');
 if p_key is null or p_code is null or p_code !~ '^[A-Z0-9_-]{1,40}$' or p_name is null or length(p_name) not between 1 and 200
 or p_category is null or p_category not in ('QC','RTG','TUKAN','FORKLIFT','TRACTOR','TRAILER','AUXILIARY','SPREADER_SEMI_AUTO','SPREADER_AUTO')
 or p_base_status is null or p_base_status not in ('available','stopped','decommissioned')
 or length(p_serial)>100 or (p_year is not null and (p_year<1900 or p_year>extract(year from current_date)))
 or length(p_notes)>2000 or not private.valid_equipment_source_codes(p_aliases) then
  raise exception using errcode='22023',message='Thông tin danh mục chưa hợp lệ';
 end if;
 if p_id is null then
  if p_version is not null then raise exception using errcode='22023',message='Phương tiện mới không có phiên bản cũ';end if;
  insert into public.equipment(id,workspace_id,code,name,category,base_status,serial_number,manufacture_year,catalog_notes,source_codes)
  values(p_key,p_workspace,p_code,p_name,p_category,p_base_status,p_serial,p_year,p_notes,p_aliases)
  on conflict(id) do nothing returning id into saved_id;
  if saved_id is not null then return saved_id;end if;
  select * into e from public.equipment where id=p_key and workspace_id=p_workspace for update;
 else
  select * into e from public.equipment where id=p_id and workspace_id=p_workspace for update;
 end if;
 if e.id is null then raise exception using errcode='42501',message='Không tìm thấy phương tiện được phép sửa';end if;
 same_data:=row(e.code,e.name,e.category,e.base_status,e.serial_number,e.manufacture_year,e.catalog_notes,e.source_codes)
  is not distinct from row(p_code,p_name,p_category,p_base_status,p_serial,p_year,p_notes,p_aliases);
 if p_id is null then
  if not same_data then raise exception using errcode='22023',message='Mã gửi lại có nội dung khác';end if;
  return e.id;
 end if;
 if e.code<>p_code then raise exception using errcode='22023',message='Không đổi mã trong biểu mẫu sửa danh mục';end if;
 if p_version is null or (e.catalog_version<>p_version and not (same_data and e.catalog_version=p_version+1)) then
  raise exception using errcode='40001',message='Danh mục đã thay đổi; hãy tải lại trước khi sửa';
 end if;
 if same_data then return e.id;end if;
 update public.equipment set name=p_name,category=p_category,base_status=p_base_status,
 serial_number=p_serial,manufacture_year=p_year,catalog_notes=p_notes,source_codes=p_aliases where id=e.id;
 return e.id;
end; $$;
revoke all on function public.save_equipment_catalog(uuid,uuid,integer,uuid,text,text,text,text,text,integer,text,text[]) from public,anon;
grant execute on function public.save_equipment_catalog(uuid,uuid,integer,uuid,text,text,text,text,text,integer,text,text[]) to authenticated;

create function public.confirm_operating_baseline(p_equipment uuid,p_hours numeric,p_start date,p_key uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare e public.equipment;
begin
 if auth.uid() is null then raise exception using errcode='42501',message='Cần đăng nhập';end if;
 select * into e from public.equipment where id=p_equipment for update;
 if e.id is null or not private.has_role(e.workspace_id,array['TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then
  raise exception using errcode='42501',message='Chỉ người quản lý khu vực được xác nhận mốc giờ';
 end if;
 if p_key is null or p_hours is null or p_hours<0 or p_hours>1000000000 or p_hours<>round(p_hours,2)
 or p_start is null or extract(day from p_start)<>1 or p_start not between date '2000-01-01' and date '2199-12-01' then
  raise exception using errcode='22023',message='Cần giờ gốc và tháng bắt đầu hợp lệ';
 end if;
 if e.hours_baseline_key is not null then
  if e.hours_baseline_key=p_key and e.hours_confirmed_by=auth.uid() and e.initial_hours=p_hours and e.hours_start_month=p_start then return e.id;end if;
  raise exception using errcode='40001',message='Mốc giờ đã được xác nhận; tải lại trang';
 end if;
 if e.initial_hours is not null and e.initial_hours<>p_hours then
  raise exception using errcode='22023',message='Giữ nguyên giờ gốc cũ khi bổ sung mốc tháng';
 end if;
 if exists(select 1 from public.monthly_operating_hours h where h.equipment_id=e.id and h.month<p_start) then
  raise exception using errcode='22023',message='Đã có giờ tháng trước mốc; cần đối chiếu để tránh cộng trùng';
 end if;
 update public.equipment set initial_hours=p_hours,hours_start_month=p_start,hours_baseline_key=p_key,
 hours_confirmed_by=auth.uid(),hours_confirmed_at=now() where id=e.id;
 return e.id;
end; $$;
revoke all on function public.confirm_operating_baseline(uuid,numeric,date,uuid) from public,anon;
grant execute on function public.confirm_operating_baseline(uuid,numeric,date,uuid) to authenticated;

-- Existing monthly parent lock serializes this check with baseline confirmation.
create function private.guard_operating_baseline_window() returns trigger
language plpgsql set search_path='' as $$
declare start_month date;
begin
 select hours_start_month into start_month from public.equipment where id=new.equipment_id;
 if start_month is not null and new.month<start_month then
  raise exception using errcode='22023',message='Không nhập giờ tháng đã nằm trong giờ gốc';
 end if;
 return new;
end; $$;
create trigger zz_hours_baseline_window before insert or update on public.monthly_operating_hours
 for each row execute function private.guard_operating_baseline_window();
revoke all on function private.guard_operating_baseline_window() from public,anon,authenticated;

-- Meter-based lifecycle features must not treat NULL as an in-range reading.
create function private.require_known_operating_meter() returns trigger
language plpgsql set search_path='' as $$
declare equipment_id uuid; meter numeric;
begin
 if tg_table_name='equipment_life_items' then equipment_id:=new.equipment_id;
 else select p.equipment_id into equipment_id from public.maintenance_plans p where p.id=new.plan_id;
 end if;
 select e.accumulated_hours into meter from public.equipment e where e.id=equipment_id;
 if meter is null then raise exception using errcode='22023',message='Chưa đối chiếu giờ gốc; chưa dùng được số đồng hồ cho định mức';end if;
 return new;
end; $$;
create trigger aa_known_life_meter before insert or update on public.equipment_life_items
 for each row execute function private.require_known_operating_meter();
create trigger aa_known_maintenance_meter before insert or update on public.maintenance_events
 for each row execute function private.require_known_operating_meter();
revoke all on function private.require_known_operating_meter() from public,anon,authenticated;
create or replace view public.vw_maintenance_due with(security_invoker=true) as
with due as (
 select p.*,e.workspace_id,e.code as equipment_code,e.accumulated_hours,
 coalesce(last_done.meter_hours,p.anchor_hours)+p.interval_hours as due_hours,
 coalesce(last_done.actual_day,p.anchor_date)+p.interval_days as due_date
 from public.maintenance_plans p join public.equipment e on e.id=p.equipment_id
 left join lateral (
  select me.meter_hours,(wc.actual_ended_at at time zone 'Asia/Bangkok')::date as actual_day
  from public.maintenance_events me join public.work_cases wc on wc.id=me.case_id
  where me.plan_id=p.id order by wc.actual_ended_at desc,me.id limit 1
 ) last_done on true where p.active
)
select due.*,
 case when accumulated_hours>=due_hours or (now() at time zone 'Asia/Bangkok')::date>=due_date then 'overdue'
 when accumulated_hours>=due_hours-warning_hours or (now() at time zone 'Asia/Bangkok')::date>=due_date-warning_days then 'due_soon'
 when accumulated_hours is null and due_hours is not null then 'unknown_meter'
 else 'normal' end as alert_level
from due;
comment on column public.equipment.initial_hours is 'Giờ gốc trước tháng bắt đầu theo dõi; NULL nghĩa là chưa đối chiếu, không phải 0 giờ';
comment on column public.equipment.hours_start_month is 'Tháng đầu được cộng vào giờ gốc; xác nhận trong Giám sát giờ hoạt động, không trong danh mục';
commit;
