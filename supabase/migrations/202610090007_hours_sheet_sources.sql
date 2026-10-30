begin;
alter table public.sheet_sources add column source_kind text not null default 'container'
 check(source_kind in ('container','hours'));
alter table public.sheet_sources add column start_month date;
alter table public.sheet_sources add constraint sheet_source_start_month_check check(
 (source_kind='container' and start_month is null) or
 (source_kind='hours' and start_month is not null and extract(day from start_month)=1 and start_month>='2000-01-01'));
create or replace function private.guard_source()
returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then new.created_by:=auth.uid();
 elsif row(new.id,new.workspace_id,new.source_kind,new.created_by,new.created_at) is distinct from
       row(old.id,old.workspace_id,old.source_kind,old.created_by,old.created_at) then
  raise exception using errcode='42501',message='Không được chuyển định danh hoặc loại nguồn'; end if;
 return new;
end; $$;
create function private.sync_monthly_source(p_source uuid,p_rows jsonb,p_key uuid,p_kind text)
returns integer language plpgsql security definer set search_path='' as $$
declare src public.sheet_sources; prior public.sheet_sync_runs; fp text; chunk jsonb; n integer; off integer; chunk_key uuid;
begin
 select * into strict src from public.sheet_sources where id=p_source for update;
 if not private.has_role(src.workspace_id,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then
  raise exception using errcode='42501',message='Không có quyền cập nhật nguồn'; end if;
 if p_kind is null or p_kind not in ('container','hours') or src.source_kind<>p_kind then
  raise exception using errcode='22023',message='Nguồn không khớp loại dữ liệu yêu cầu'; end if;
 if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 10000 or p_key is null then
  raise exception using errcode='22023',message='Nguồn phải có 1–10.000 dòng'; end if;
 if p_kind='container' then perform private.validate_container_counts(p_rows);
 else
  if exists(select 1 from jsonb_array_elements(p_rows) r where jsonb_typeof(r)<>'object') then
   raise exception using errcode='22023',message='Mỗi dòng giờ phải là một đối tượng'; end if;
  if exists(select 1 from jsonb_array_elements(p_rows) r cross join lateral jsonb_object_keys(r) k
   where k not in ('equipment_code','month','operating_hours')) then
   raise exception using errcode='22023',message='Nguồn giờ chỉ nhận mã phương tiện, tháng và giờ hoạt động'; end if;
  if exists(select 1 from jsonb_array_elements(p_rows) r where jsonb_typeof(r->'operating_hours') is distinct from 'number') then
   raise exception using errcode='22023',message='Giờ hoạt động phải là số'; end if;
  if exists(select 1 from jsonb_to_recordset(p_rows) r(operating_hours numeric,month date)
   where operating_hours is null or operating_hours<0 or round(operating_hours,2)<>operating_hours
    or month is null or month<src.start_month) then
   raise exception using errcode='22023',message='Sai giờ, độ chính xác hoặc tháng trước mốc nguồn'; end if;
 end if;
 fp:=md5(p_rows::text);
 select * into prior from public.sheet_sync_runs where request_key=p_key;
 if found then
  if prior.source_id<>p_source or prior.actor_id<>auth.uid() or prior.fingerprint<>fp then
   raise exception using errcode='22023',message='Khóa cập nhật đã dùng cho dữ liệu khác'; end if;return prior.row_count;
 end if;
 if exists(select 1 from jsonb_to_recordset(p_rows) as r(equipment_code text,month date)
 group by equipment_code,month having count(*)>1) then
  raise exception using errcode='22023',message='Trùng dòng phương tiện/tháng trong nguồn'; end if;
 n:=jsonb_array_length(p_rows);off:=0;
 while off<n loop
  select jsonb_agg(value order by ordinality) into chunk from jsonb_array_elements(p_rows) with ordinality
   where ordinality>off and ordinality<=off+1000;
  chunk_key:=md5(p_key::text||':'||off)::uuid;
  perform private.import_split(src.workspace_id,p_kind,chunk,chunk_key);
  off:=off+1000;
 end loop;
 insert into public.sheet_sync_runs(source_id,workspace_id,request_key,actor_id,fingerprint,accepted_rows,row_count)
 values(p_source,src.workspace_id,p_key,auth.uid(),fp,p_rows,n);
 return n;
end; $$;
create or replace function private.sync_container_source(p_source uuid,p_rows jsonb,p_key uuid)
returns integer language sql security invoker set search_path='' as $$
 select private.sync_monthly_source(p_source,p_rows,p_key,'container');
$$;
create function public.sync_hours_source(p_source uuid,p_rows jsonb,p_key uuid)
returns integer language sql security invoker set search_path='' as $$
 select private.sync_monthly_source(p_source,p_rows,p_key,'hours');
$$;
revoke execute on function private.sync_monthly_source(uuid,jsonb,uuid,text),public.sync_hours_source(uuid,jsonb,uuid) from public,anon;
grant execute on function private.sync_monthly_source(uuid,jsonb,uuid,text),public.sync_hours_source(uuid,jsonb,uuid) to authenticated;
commit;
