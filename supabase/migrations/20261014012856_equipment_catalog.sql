begin;
set local lock_timeout='5s';
alter table public.equipment drop constraint equipment_category_check;
alter table public.equipment add constraint equipment_category_check check(category in
 ('QC','RTG','TUKAN','FORKLIFT','TRACTOR','TRAILER','AUXILIARY','SPREADER_SEMI_AUTO','SPREADER_AUTO'));
alter table public.equipment
 add column serial_number text check(serial_number is null or length(serial_number) between 1 and 100),
 add column manufacture_year integer check(manufacture_year between 1900 and 2100),
 add column catalog_notes text not null default '' check(length(catalog_notes)<=2000),
 add column source_codes text[] not null default '{}',
 add column catalog_version integer not null default 1 check(catalog_version>0);

create function private.valid_equipment_source_codes(p_codes text[]) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(cardinality(p_codes)<=20 and (cardinality(p_codes)=0 or array_ndims(p_codes)=1)
 and not exists(select 1 from unnest(p_codes) a where a is null or a !~ '^[A-Za-z0-9_-]{1,40}$')
 and (select count(*)=count(distinct lower(a)) from unnest(p_codes) a),false)
$$;
alter table public.equipment add constraint equipment_source_codes_check check(private.valid_equipment_source_codes(source_codes));
revoke all on function private.valid_equipment_source_codes(text[]) from public,anon;
grant execute on function private.valid_equipment_source_codes(text[]) to authenticated;

create function private.guard_equipment_catalog() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then new.catalog_version:=1;
 else
  if new.catalog_version<>old.catalog_version then
   raise exception using errcode='42501',message='Phiên bản danh mục do hệ thống quản lý';
  end if;
  if row(new.name,new.category,new.base_status,new.serial_number,new.manufacture_year,new.catalog_notes,new.source_codes,new.initial_hours)
    is distinct from row(old.name,old.category,old.base_status,old.serial_number,old.manufacture_year,old.catalog_notes,old.source_codes,old.initial_hours) then
   new.catalog_version:=old.catalog_version+1;
  end if;
 end if;
 return new;
end; $$;
create trigger equipment_catalog_guard before insert or update on public.equipment
 for each row execute function private.guard_equipment_catalog();
revoke all on function private.guard_equipment_catalog() from public,anon,authenticated;

-- Invoker preserves existing leader-only table RLS. No privileged data API.
create function public.save_equipment_catalog(
 p_workspace uuid,p_id uuid,p_version integer,p_key uuid,p_code text,p_name text,p_category text,
 p_base_status text,p_serial text,p_year integer,p_notes text,p_aliases text[],p_initial_hours numeric)
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
 or length(p_notes)>2000 or not private.valid_equipment_source_codes(p_aliases)
 or p_initial_hours is null or p_initial_hours<0 or p_initial_hours>1000000000 or p_initial_hours<>round(p_initial_hours,2) then
  raise exception using errcode='22023',message='Thông tin danh mục chưa hợp lệ';
 end if;
 if p_id is null then
  if p_version is not null then raise exception using errcode='22023',message='Phương tiện mới không có phiên bản cũ';end if;
  insert into public.equipment(id,workspace_id,code,name,category,base_status,serial_number,manufacture_year,catalog_notes,source_codes,initial_hours)
  values(p_key,p_workspace,p_code,p_name,p_category,p_base_status,p_serial,p_year,p_notes,p_aliases,p_initial_hours)
  on conflict(id) do nothing returning id into saved_id;
  if saved_id is not null then return saved_id;end if;
  select * into e from public.equipment where id=p_key and workspace_id=p_workspace for update;
 else
  select * into e from public.equipment where id=p_id and workspace_id=p_workspace for update;
 end if;
 if e.id is null then raise exception using errcode='42501',message='Không tìm thấy phương tiện được phép sửa';end if;
 same_data:=row(e.code,e.name,e.category,e.base_status,e.serial_number,e.manufacture_year,e.catalog_notes,e.source_codes,e.initial_hours)
   is not distinct from row(p_code,p_name,p_category,p_base_status,p_serial,p_year,p_notes,p_aliases,p_initial_hours);
 if p_id is null then
  if not same_data then raise exception using errcode='22023',message='Mã gửi lại có nội dung khác';end if;
  return e.id;
 end if;
 if e.code<>p_code or e.initial_hours<>p_initial_hours then
  raise exception using errcode='22023',message='Không đổi mã hoặc giờ ban đầu trong biểu mẫu sửa danh mục';
 end if;
 if p_version is null or (e.catalog_version<>p_version and not (same_data and e.catalog_version=p_version+1)) then
  raise exception using errcode='40001',message='Danh mục đã thay đổi; hãy tải lại trước khi sửa';
 end if;
 if same_data then return e.id;end if;
 update public.equipment set name=p_name,category=p_category,base_status=p_base_status,
 serial_number=p_serial,manufacture_year=p_year,catalog_notes=p_notes,source_codes=p_aliases where id=e.id;
 return e.id;
end; $$;
revoke all on function public.save_equipment_catalog(uuid,uuid,integer,uuid,text,text,text,text,text,integer,text,text[],numeric) from public,anon;
grant execute on function public.save_equipment_catalog(uuid,uuid,integer,uuid,text,text,text,text,text,integer,text,text[],numeric) to authenticated;
comment on column public.equipment.source_codes is 'Mã tham chiếu nguồn; không tự suy đoán liên kết lắp khung hoặc cấu hình đồng bộ bảng tính';
comment on column public.equipment.catalog_version is 'Kiểm soát sửa danh mục đồng thời; không phải phiên bản số liệu tháng';
commit;
