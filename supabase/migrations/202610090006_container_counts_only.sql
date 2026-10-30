-- Counts-only business contract. Preserve dormant historical columns and snapshots.
-- No old migration is rewritten and no production data is deleted.
begin;
create function private.validate_container_counts(p_rows jsonb)
returns void language plpgsql immutable security invoker set search_path='' as $$
begin
 if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 10000 then
  raise exception using errcode='22023',message='Cần lô số container hợp lệ'; end if;
 if exists(select 1 from jsonb_array_elements(p_rows) r where jsonb_typeof(r)<>'object') then
  raise exception using errcode='22023',message='Mỗi dòng container phải là một đối tượng'; end if;
 if exists(select 1 from jsonb_array_elements(p_rows) r cross join lateral jsonb_object_keys(r) k
  where k not in ('equipment_code','month','boxes')) then
  raise exception using errcode='22023',message='Chỉ nhận mã phương tiện, tháng và số container (chiếc)'; end if;
 if exists(select 1 from jsonb_array_elements(p_rows) r where
  jsonb_typeof(r->'boxes') is distinct from 'number' or coalesce(r->>'boxes','') !~ '^[0-9]+$') then
  raise exception using errcode='22023',message='Số container phải là số nguyên không âm'; end if;
 if exists(select 1 from jsonb_array_elements(p_rows) r where (r->>'boxes')::numeric>9007199254740991) then
  raise exception using errcode='22023',message='Số container vượt giới hạn biểu diễn chính xác'; end if;
end; $$;
create or replace function private.import_split(p_workspace uuid,p_kind text,p_rows jsonb,p_key uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare fp text; prior private.import_requests; n integer;
begin
 if not private.has_role(p_workspace,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then
  raise exception using errcode='42501',message='Không có quyền nhập số liệu tháng'; end if;
 if p_kind not in ('hours','container','other') or p_key is null or p_rows is null or jsonb_typeof(p_rows)<>'array'
 or jsonb_array_length(p_rows) not between 1 and 1000 then
  raise exception using errcode='22023',message='Loại import hoặc số dòng không hợp lệ'; end if;
 if p_kind='container' then perform private.validate_container_counts(p_rows); end if;
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
  if exists(select 1 from jsonb_to_recordset(p_rows) as r(boxes bigint) where boxes is null or boxes<0) then
   raise exception using errcode='22023',message='Thiếu hoặc sai số container (chiếc)'; end if;
  insert into public.monthly_production(equipment_id,month,boxes)
  select e.id,r.month,r.boxes from jsonb_to_recordset(p_rows) as r(equipment_code text,month date,boxes bigint)
  join public.equipment e on e.workspace_id=p_workspace and e.code=r.equipment_code
  on conflict(equipment_id,month) do update set boxes=excluded.boxes;
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

create or replace function private.sync_container_source(p_source uuid,p_rows jsonb,p_key uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare src public.sheet_sources; prior public.sheet_sync_runs; fp text; chunk jsonb; n integer; off integer; chunk_key uuid;
begin
 select * into strict src from public.sheet_sources where id=p_source for update;
 if not private.has_role(src.workspace_id,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then
  raise exception using errcode='42501',message='Không có quyền cập nhật nguồn'; end if;
 if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 10000 or p_key is null then
  raise exception using errcode='22023',message='Nguồn phải có 1–10.000 dòng'; end if;
 perform private.validate_container_counts(p_rows);
 fp:=md5(p_rows::text);
 select * into prior from public.sheet_sync_runs where request_key=p_key;
 if found then
  if prior.source_id<>p_source or prior.actor_id<>auth.uid() or prior.fingerprint<>fp then
   raise exception using errcode='22023',message='Khóa cập nhật đã dùng cho dữ liệu khác'; end if;return prior.row_count;
 end if;
 if exists(select 1 from jsonb_to_recordset(p_rows) as r(equipment_code text,month date)
 group by equipment_code,month having count(*)>1) then raise exception using errcode='22023',message='Trùng dòng phương tiện/tháng trong nguồn'; end if;
 n:=jsonb_array_length(p_rows);off:=0;
 while off<n loop
  select jsonb_agg(value order by ordinality) into chunk from jsonb_array_elements(p_rows) with ordinality
   where ordinality>off and ordinality<=off+1000;
  chunk_key:=md5(p_key::text||':'||off)::uuid;
  perform private.import_split(src.workspace_id,'container',chunk,chunk_key);
  off:=off+1000;
 end loop;
 insert into public.sheet_sync_runs(source_id,workspace_id,request_key,actor_id,fingerprint,accepted_rows,row_count)
 values(p_source,src.workspace_id,p_key,auth.uid(),fp,p_rows,n);
 return n;
end; $$;

create function private.freeze_legacy_container_unit()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if (tg_op='INSERT' and new.teu is not null) or
    (tg_op='UPDATE' and new.teu is distinct from old.teu) then
  raise exception using errcode='22023',message='Chỉ ghi nhận số container (chiếc); trường quy đổi cũ đã ngừng sử dụng'; end if;
 return new;
end; $$;
create trigger zz_container_counts_only before insert or update on public.monthly_production
 for each row execute function private.freeze_legacy_container_unit();
comment on column public.monthly_production.teu is
 'Deprecated historical field, frozen by trigger; not used in current input, reporting or export. Retained solely to avoid data loss on upgrade.';
revoke execute on function public.import_monthly_metrics(uuid,jsonb,uuid),private.import_monthly(uuid,jsonb,uuid) from authenticated,anon,public;
revoke select on public.vw_monthly_metrics from authenticated,anon,public;
create view public.vw_monthly_activity with(security_invoker=true) as
with k as(select equipment_id,month from public.monthly_production
 union select equipment_id,month from public.monthly_operating_hours)
select e.id as equipment_id,e.workspace_id,e.code as equipment_code,k.month,p.boxes,h.operating_hours,e.accumulated_hours
from k join public.equipment e on e.id=k.equipment_id
left join public.monthly_production p on p.equipment_id=k.equipment_id and p.month=k.month
left join public.monthly_operating_hours h on h.equipment_id=k.equipment_id and h.month=k.month;
revoke all on public.vw_monthly_activity from public,anon;
grant select on public.vw_monthly_activity to authenticated;

drop function public.report_material_costs(uuid,date,date);
create function public.report_material_costs(p_workspace uuid,p_from date,p_to date)
returns table(equipment_id uuid,equipment_code text,known_cost_vnd numeric,unpriced_usages bigint,
 container_boxes numeric,missing_container_months integer)
language sql stable security invoker set search_path='' as $$
with b as(select true ok where private.validate_report_period(p_workspace,p_from,p_to))
select e.id,e.code,
 coalesce((select sum(u.quantity*u.unit_cost_vnd) from public.repair_material_usages u
 join public.repair_work_items i on i.id=u.repair_work_item_id join public.repair_orders r on r.id=i.repair_order_id
 where r.equipment_id=e.id and u.installed_at>=p_from::timestamp at time zone 'Asia/Bangkok'
 and u.installed_at<p_to::timestamp at time zone 'Asia/Bangkok'),0),
 (select count(*) from public.repair_material_usages u join public.repair_work_items i on i.id=u.repair_work_item_id
 join public.repair_orders r on r.id=i.repair_order_id where r.equipment_id=e.id
 and u.installed_at>=p_from::timestamp at time zone 'Asia/Bangkok'
 and u.installed_at<p_to::timestamp at time zone 'Asia/Bangkok' and u.unit_cost_vnd is null),
 (select sum(p.boxes) from public.monthly_production p where p.equipment_id=e.id and p.month>=p_from and p.month<p_to),
 (extract(year from age(p_to,p_from))*12+extract(month from age(p_to,p_from)))::integer-
 (select count(*)::integer from public.monthly_production p where p.equipment_id=e.id and p.month>=p_from and p.month<p_to)
from public.equipment e cross join b where e.workspace_id=p_workspace;
$$;
revoke execute on function private.validate_container_counts(jsonb),public.report_material_costs(uuid,date,date) from public,anon;
grant execute on function private.validate_container_counts(jsonb),public.report_material_costs(uuid,date,date) to authenticated;
commit;
