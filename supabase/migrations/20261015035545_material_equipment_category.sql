begin;
set local lock_timeout='5s';
alter table public.materials add column equipment_category text;
alter table public.materials add constraint materials_equipment_category_valid check(equipment_category is null or equipment_category in ('COMMON','QC','RTG','TUKAN','FORKLIFT','TRACTOR','TRAILER','AUXILIARY','SPREADER_SEMI_AUTO','SPREADER_AUTO'));
comment on column public.materials.equipment_category is 'Loại phương tiện áp dụng; NULL chưa phân loại, COMMON dùng chung. Không thay định mức hoặc tồn kho.';
create or replace function public.preview_import_table(p_workspace uuid,p_kind text,p_rows jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r jsonb; result jsonb:='[]'; old_row jsonb; snap jsonb; e public.equipment; m public.materials; c public.cargo_types;
 n integer:=0; seen text[]:='{}'; business_key text; aliases text[]; amount numeric; day date; allowed text[];
begin
 if not private.bulk_allowed(p_workspace,p_kind) then raise exception using errcode='42501',message='Không có quyền nhập bảng dữ liệu này';end if;
 if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 500 or octet_length(p_rows::text)>500000 then
  raise exception using errcode='22023',message='TVEAM: Nhập 1–500 dòng, tối đa 500 KB dữ liệu đã đọc';end if;
 allowed:=case p_kind when 'equipment' then array['code','name','category','base_status','serial','year','aliases','notes']
 when 'materials' then array['code','name','unit'] when 'cargo' then array['code','name','unit']
 when 'hours' then array['equipment_code','month','operating_hours'] when 'container' then array['equipment_code','month','boxes']
 else array['equipment_code','month','cargo_code','quantity'] end;
 for r in select value from jsonb_array_elements(p_rows) loop
  n:=n+1;old_row:=null;snap:=null;e:=null;m:=null;c:=null;
  if p_kind='materials' then allowed:=array['code','name','unit'];if r ? 'equipment_category' then allowed:=array_append(allowed,'equipment_category');end if;end if;
  if jsonb_typeof(r)<>'object' or not r ?& allowed or exists(select 1 from jsonb_object_keys(r) k where k<>all(allowed)) then
   raise exception using errcode='22023',message='TVEAM: Sai cột ở dòng dữ liệu '||n;end if;
  if exists(select 1 from jsonb_each(r) j where j.key in ('code','equipment_code','name','unit','category','base_status','notes','month','cargo_code') and jsonb_typeof(j.value)<>'string')
   or (r ? 'serial' and jsonb_typeof(r->'serial') not in ('string','null'))
   or (r ? 'year' and jsonb_typeof(r->'year') not in ('number','null'))
   or (r ? 'equipment_category' and jsonb_typeof(r->'equipment_category') not in ('string','null')) then
   raise exception using errcode='22023',message='TVEAM: Sai kiểu ô dữ liệu ở dòng '||n;end if;
  if coalesce(r->>'code',r->>'equipment_code','') !~ '^[A-Z0-9_-]{1,40}$' then
   raise exception using errcode='22023',message='TVEAM: Mã chưa hợp lệ ở dòng dữ liệu '||n;end if;
  business_key:=coalesce(r->>'code',r->>'equipment_code')||'|'||coalesce(r->>'month','')||'|'||coalesce(r->>'cargo_code','');
  if business_key=any(seen) then raise exception using errcode='22023',message='TVEAM: Trùng khóa dữ liệu ở dòng '||n;end if;seen:=array_append(seen,business_key);
  if p_kind='equipment' then
   if coalesce(length(btrim(r->>'name')),0) not between 1 and 200 or r->>'category' not in ('QC','RTG','TUKAN','FORKLIFT','TRACTOR','TRAILER','AUXILIARY','SPREADER_SEMI_AUTO','SPREADER_AUTO')
    or r->>'base_status' not in ('available','stopped','decommissioned') or length(coalesce(r->>'serial',''))>100 or length(coalesce(r->>'notes',''))>2000
    or jsonb_typeof(r->'aliases')<>'array' then raise exception using errcode='22023',message='TVEAM: Sai thông tin phương tiện ở dòng '||n;end if;
   aliases:=array(select jsonb_array_elements_text(r->'aliases'));
   if not private.valid_equipment_source_codes(aliases) or (r->>'year' is not null and (jsonb_typeof(r->'year')<>'number' or (r->>'year')::numeric<>trunc((r->>'year')::numeric)
    or (r->>'year')::numeric not between 1900 and extract(year from current_date))) then
    raise exception using errcode='22023',message='TVEAM: Sai năm hoặc mã tham chiếu ở dòng '||n;end if;
   select * into e from public.equipment where workspace_id=p_workspace and code=r->>'code';
   if e.id is not null then
    snap:=jsonb_build_object('id',e.id,'version',e.catalog_version);
    old_row:=jsonb_build_object('code',e.code,'name',e.name,'category',e.category,'base_status',e.base_status,'serial',e.serial_number,'year',e.manufacture_year,'aliases',e.source_codes,'notes',e.catalog_notes);
   end if;
  elsif p_kind in ('materials','cargo') then
   if coalesce(length(btrim(r->>'name')),0) not between 1 and 200 or coalesce(length(btrim(r->>'unit')),0) not between 1 and 40 then
    raise exception using errcode='22023',message='TVEAM: Thiếu tên hoặc đơn vị ở dòng '||n;end if;
   if p_kind='materials' then
    if r ? 'equipment_category' and r->>'equipment_category' is not null and r->>'equipment_category' not in ('COMMON','QC','RTG','TUKAN','FORKLIFT','TRACTOR','TRAILER','AUXILIARY','SPREADER_SEMI_AUTO','SPREADER_AUTO') then raise exception using errcode='22023',message='TVEAM: Loại phương tiện không hợp lệ ở dòng '||n;end if;
    select * into m from public.materials where workspace_id=p_workspace and code=r->>'code';
    if m.id is not null then snap:=jsonb_build_object('id',m.id,'name',m.name,'unit',m.unit);old_row:=jsonb_build_object('code',m.code,'name',m.name,'unit',m.unit);
     if r ? 'equipment_category' then snap:=snap||jsonb_build_object('equipment_category',m.equipment_category);old_row:=old_row||jsonb_build_object('equipment_category',m.equipment_category);end if;
    end if;
   else
    if r->>'unit' not in ('TONNE','M3','ITEM','TRIP') then raise exception using errcode='22023',message='TVEAM: Đơn vị loại hàng chưa hợp lệ ở dòng '||n;end if;
    select * into c from public.cargo_types where workspace_id=p_workspace and code=r->>'code';
    if c.id is not null then snap:=jsonb_build_object('id',c.id,'name',c.name,'unit',c.unit);old_row:=jsonb_build_object('code',c.code,'name',c.name,'unit',c.unit);end if;
   end if;
   if snap is not null and snap->>'unit'<>r->>'unit' then raise exception using errcode='22023',message='TVEAM: Giữ nguyên đơn vị của mã đã có ở dòng '||n;end if;
  else
   if coalesce(r->>'month','') !~ '^(20[0-9]{2}|21[0-9]{2})-(0[1-9]|1[0-2])-01$' then raise exception using errcode='22023',message='TVEAM: Sai tháng ở dòng '||n;end if;
   day:=(r->>'month')::date;
   select * into e from public.equipment where workspace_id=p_workspace and code=r->>'equipment_code';
   if e.id is null then raise exception using errcode='22023',message='TVEAM: Phương tiện chưa có trong danh mục ở dòng '||n;end if;
   if p_kind='hours' then
    if jsonb_typeof(r->'operating_hours')<>'number' then raise exception using errcode='22023',message='TVEAM: Giờ cần là số ở dòng '||n;end if;
    amount:=(r->>'operating_hours')::numeric;
    if amount<0 or amount<>round(amount,2) or amount>extract(day from day+interval '1 month - 1 day')*24 or (e.hours_start_month is not null and day<e.hours_start_month) then
     raise exception using errcode='22023',message='TVEAM: Sai giờ, vượt giờ lịch hoặc tháng đã nằm trong giờ gốc ở dòng '||n;end if;
    select jsonb_build_object('id',h.id,'amount',h.operating_hours),jsonb_build_object('equipment_code',e.code,'month',h.month,'operating_hours',h.operating_hours)
     into snap,old_row from public.monthly_operating_hours h where h.equipment_id=e.id and h.month=day;
   elsif p_kind='container' then
    if jsonb_typeof(r->'boxes')<>'number' then raise exception using errcode='22023',message='TVEAM: Số container cần là số ở dòng '||n;end if;
    amount:=(r->>'boxes')::numeric;
    if amount<0 or amount<>trunc(amount) or amount>9007199254740991 then raise exception using errcode='22023',message='TVEAM: Sai số container ở dòng '||n;end if;
    select jsonb_build_object('id',h.id,'amount',h.boxes),jsonb_build_object('equipment_code',e.code,'month',h.month,'boxes',h.boxes)
     into snap,old_row from public.monthly_production h where h.equipment_id=e.id and h.month=day;
   else
    if coalesce(r->>'cargo_code','') !~ '^[A-Z0-9_-]{1,40}$' or jsonb_typeof(r->'quantity')<>'number' then raise exception using errcode='22023',message='TVEAM: Sai loại hàng hoặc sản lượng ở dòng '||n;end if;
    amount:=(r->>'quantity')::numeric;
    select * into c from public.cargo_types where workspace_id=p_workspace and code=r->>'cargo_code';
    if c.id is null or amount<0 or amount<>round(amount,3) or amount>1000000000000 then raise exception using errcode='22023',message='TVEAM: Loại hàng chưa khai báo hoặc sai sản lượng ở dòng '||n;end if;
    select jsonb_build_object('id',h.id,'amount',h.quantity,'unit',c.unit),jsonb_build_object('equipment_code',e.code,'month',h.month,'cargo_code',c.code,'quantity',h.quantity)
     into snap,old_row from public.monthly_other_cargo h where h.equipment_id=e.id and h.cargo_type_id=c.id and h.month=day;
   end if;
  end if;
  result:=result||jsonb_build_array(jsonb_build_object('row',r,'expected',snap,'previous',old_row,'action',case when snap is null then 'add' when old_row=r then 'same' else 'update' end));
 end loop;return result;
end; $$;
revoke all on function public.preview_import_table(uuid,text,jsonb) from public,anon;
grant execute on function public.preview_import_table(uuid,text,jsonb) to authenticated;

create or replace function public.import_table_batch(p_workspace uuid,p_kind text,p_mode text,p_plan jsonb,p_key uuid) returns integer
language plpgsql security invoker set search_path='' as $$
declare prior integer; rows jsonb; current_plan jsonb; item jsonb; r jsonb; snap jsonb; id uuid; i integer:=0;
begin
 prior:=private.bulk_table_request(p_workspace,p_kind,p_mode,p_plan,p_key,false);if prior is not null then return prior;end if;
 if exists(select 1 from jsonb_array_elements(p_plan) p where jsonb_typeof(p)<>'object' or not p ?& array['row','expected']) then
  raise exception using errcode='22023',message='Sai bản xem trước';end if;
 select jsonb_agg(value->'row' order by ordinality) into rows from jsonb_array_elements(p_plan) with ordinality;
 current_plan:=public.preview_import_table(p_workspace,p_kind,rows);
 for item in select value from jsonb_array_elements(p_plan) loop
  if item->'expected' is distinct from current_plan->i->'expected' then raise exception using errcode='40001',message='Dữ liệu đã thay đổi sau xem trước; hãy kiểm tra lại';end if;
  if p_mode='add' and item->'expected'<>'null'::jsonb then raise exception using errcode='22023',message='TVEAM: Đang chọn chỉ thêm mới nhưng có mã hoặc tháng đã tồn tại';end if;i:=i+1;
 end loop;
 if p_kind in ('hours','container','other') then
  if p_kind='hours' then perform public.import_operating_months(p_workspace,rows,p_key);
  elsif p_kind='container' then perform public.import_container_months(p_workspace,rows,p_key);
  else perform public.import_other_cargo_months(p_workspace,rows,p_key);end if;
 else
  for item in select value from jsonb_array_elements(current_plan) loop
   r:=item->'row';snap:=item->'expected';
   if p_kind='equipment' then
    perform public.save_equipment_catalog(p_workspace,(snap->>'id')::uuid,(snap->>'version')::integer,gen_random_uuid(),r->>'code',r->>'name',r->>'category',r->>'base_status',r->>'serial',(r->>'year')::integer,r->>'notes',array(select jsonb_array_elements_text(r->'aliases')));
   elsif p_kind='materials' then
    insert into public.materials(workspace_id,code,name,unit,equipment_category) values(p_workspace,r->>'code',r->>'name',r->>'unit',r->>'equipment_category')
     on conflict(workspace_id,code) do update set name=excluded.name,equipment_category=case when r ? 'equipment_category' then excluded.equipment_category else materials.equipment_category end;
   else
    insert into public.cargo_types(workspace_id,code,name,unit) values(p_workspace,r->>'code',r->>'name',(r->>'unit')::public.cargo_unit)
     on conflict(workspace_id,code) do update set name=excluded.name;
   end if;
  end loop;
 end if;
 return private.bulk_table_request(p_workspace,p_kind,p_mode,p_plan,p_key,true);
end; $$;
revoke all on function public.import_table_batch(uuid,text,text,jsonb,uuid) from public,anon;
grant execute on function public.import_table_batch(uuid,text,text,jsonb,uuid) to authenticated;
commit;
