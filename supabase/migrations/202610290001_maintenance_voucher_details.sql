-- Persist one validated document number/date per generated maintenance voucher.
begin;

CREATE OR REPLACE FUNCTION private.save_maintenance_requisition_v3(p_workspace uuid, p_planned_day date, p_document_day date, p_voucher_kind text, p_supplement_note text, p_grouping text, p_rows jsonb, p_print jsonb, p_source_filename text, p_source_sha256 text, p_key uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare fp text; prior private.maintenance_requisition_requests; rid uuid; r jsonb; m jsonb; e public.equipment;
 cid uuid; oid uuid; summary_text text; saved_rows jsonb:='[]'; seen uuid[]:='{}'; amount numeric; k text; v jsonb; clean_note text; print_data jsonb; catalog public.materials;
begin
 if auth.uid() is null or not private.has_role(p_workspace,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then
  raise exception using errcode='42501',message='Không có quyền lập kế hoạch'; end if;
 clean_note:=nullif(btrim(p_supplement_note),'');
 if p_document_day is null or p_document_day not between date '2000-01-01' and date '2100-12-31'
 or p_voucher_kind is null or p_voucher_kind not in ('planned','supplemental')
 or (p_voucher_kind='planned' and clean_note is not null)
 or (p_voucher_kind='supplemental' and (clean_note is null or length(clean_note) not between 3 and 500))
 or (p_source_filename is null)<>(p_source_sha256 is null)
 or (p_source_filename is not null and (length(btrim(p_source_filename)) not between 1 and 255 or p_source_filename like '%/%' or position(chr(92) in p_source_filename)>0 or p_source_filename !~* '[.]pdf$' or p_source_sha256 !~ '^[a-f0-9]{64}$')) then
  raise exception using errcode='22023',message='Sai ngày, loại phiếu hoặc tệp nguồn'; end if;
 if p_key is null or p_planned_day is null or p_planned_day<date '2000-01-01' or p_planned_day>date '2100-12-31'
 or p_grouping is null or p_grouping not in ('equipment','group','date') or p_rows is null or jsonb_typeof(p_rows)<>'array'
 or jsonb_array_length(p_rows) not between 1 and 60 or octet_length(p_rows::text)>400000
 or p_print is null or jsonb_typeof(p_print)<>'object' then
  raise exception using errcode='22023',message='Sai dữ liệu kế hoạch'; end if;
 if (p_print-array['company','department','recipient','warehouse','consumableWarehouse','documentDay','voucherDetails','voucherKind','supplementNote'])<>'{}'
 or not p_print ?& array['company','department','recipient','warehouse','consumableWarehouse','documentDay'] then
  raise exception using errcode='22023',message='Sai thông tin in'; end if;
 if p_print ? 'voucherDetails' and (
 jsonb_typeof(p_print->'voucherDetails')<>'array'
 or jsonb_array_length(p_print->'voucherDetails') not between 1 and 200
 or exists(
  select 1 from jsonb_array_elements(p_print->'voucherDetails') as d(value)
  where jsonb_typeof(d.value)<>'object'
   or not d.value ?& array['id','documentNumber','documentDay']
   or (d.value-array['id','documentNumber','documentDay'])<>'{}'
   or jsonb_typeof(d.value->'id')<>'string'
   or jsonb_typeof(d.value->'documentNumber')<>'string'
   or jsonb_typeof(d.value->'documentDay')<>'string'
   or length(btrim(d.value->>'id')) not between 1 and 200
   or length(btrim(d.value->>'documentNumber')) not between 1 and 200
   or d.value->>'documentDay' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
   or (d.value->>'documentDay')::date not between date '2000-01-01' and date '2100-12-31'
   or (d.value->>'id') ~ '[[:cntrl:]]'
   or (d.value->>'documentNumber') ~ '[[:cntrl:]]'
 )
 or (select count(*)<>count(distinct d.value->>'id') from jsonb_array_elements(p_print->'voucherDetails') as d(value))) then
  raise exception using errcode='22023',message='Sai thông tin số hoặc ngày từng phiếu';
 end if;
 for k,v in select * from jsonb_each(p_print) where key<>'voucherDetails' loop
  if jsonb_typeof(v)<>'string' or length(v#>>'{}')>(case when k='supplementNote' then 500 else 200 end) or (v#>>'{}') ~ '[[:cntrl:]]' then raise exception using errcode='22023',message='Sai thông tin in'; end if;
 end loop;
 if length(btrim(p_print->>'company'))=0 or length(btrim(p_print->>'department'))=0 or length(p_print->>'recipient')>100
 or p_print->>'documentDay' !~ '^\d{4}-\d{2}-\d{2}$' or (p_print->>'documentDay')::date not between date '2000-01-01' and date '2100-12-31' then
  raise exception using errcode='22023',message='Thiếu thông tin in'; end if;
 print_data:=(p_print-array['documentDay','voucherKind','supplementNote'])||jsonb_build_object('documentDay',p_document_day::text,'voucherKind',p_voucher_kind,'supplementNote',coalesce(clean_note,''));
 fp:=encode(sha256(convert_to(jsonb_build_array(p_workspace,p_planned_day,p_grouping,p_rows,print_data,p_source_filename,p_source_sha256)::text,'UTF8')),'hex');
 -- Serialize a workspace batch; individual equipment locks follow in stable order.
 perform 1 from public.workspaces where id=p_workspace for update;
 select * into prior from private.maintenance_requisition_requests where request_key=p_key;
 if found then
  if prior.actor_id<>auth.uid() or prior.fingerprint<>fp then raise exception using errcode='22023',message='Khóa yêu cầu đã dùng'; end if;
  return prior.run_id;
 end if;
 select id into rid from public.maintenance_requisition_runs where workspace_id=p_workspace and created_by=auth.uid() and fingerprint=fp;
 if rid is not null then
  insert into private.maintenance_requisition_requests values(p_key,auth.uid(),fp,rid);return rid;
 end if;
 for r in select value from jsonb_array_elements(p_rows) order by value->>'equipmentId' loop
  if jsonb_typeof(r)<>'object' or not r ?& array['equipmentId','equipmentCode','sourceLabel','group','maintenanceLevel','materials']
  or (r-array['equipmentId','equipmentCode','equipmentName','sourceLabel','group','maintenanceLevel','operatingReading','materials'])<>'{}'
  or r->>'group' not in ('TUKAN','QC','RTG','KHUNG_CAU') or r->>'maintenanceLevel' not in ('I - theo giờ','I - theo tháng','II')
  or coalesce(length(btrim(r->>'sourceLabel')),0) not between 1 and 200
  or jsonb_typeof(r->'materials')<>'array' or jsonb_array_length(r->'materials') not between 1 and 20 then
   raise exception using errcode='22023',message='Sai dòng kế hoạch'; end if;
  for k,v in select * from jsonb_each(r) where key<>'materials' loop
   if jsonb_typeof(v)<>'string' or length(v#>>'{}')>200 or (v#>>'{}') ~ '[[:cntrl:]]' then raise exception using errcode='22023',message='Sai trường kế hoạch'; end if;
  end loop;
  select * into e from public.equipment where id=(r->>'equipmentId')::uuid and workspace_id=p_workspace for update;
  if not found or e.code is distinct from r->>'equipmentCode' or e.base_status='decommissioned' then raise exception using errcode='22023',message='Phương tiện không khớp danh mục'; end if;
  if e.id=any(seen) then raise exception using errcode='22023',message='Phương tiện bị trùng'; end if;
  seen:=array_append(seen,e.id);
  for m in select value from jsonb_array_elements(r->'materials') loop
   if jsonb_typeof(m)<>'object' or not m ?& array['key','name','unit','quantity','source']
   or (m-array['key','name','unit','quantity','source','catalogueCode'])<>'{}'
   or jsonb_typeof(m->'quantity')<>'number' or m->>'source' not in ('warehouse','maintenance_consumable')
   or coalesce(length(btrim(m->>'key')),0) not between 1 and 100
   or coalesce(length(btrim(m->>'name')),0) not between 1 and 500
   or coalesce(length(btrim(m->>'unit')),0) not between 1 and 40 or length(coalesce(m->>'catalogueCode',''))>100 then
    raise exception using errcode='22023',message='Sai vật tư kế hoạch'; end if;
   for k,v in select * from jsonb_each(m) where key<>'quantity' loop
    if jsonb_typeof(v)<>'string' or (v#>>'{}') ~ '[[:cntrl:]]' then raise exception using errcode='22023',message='Sai trường vật tư'; end if;
   end loop;
   if p_voucher_kind='supplemental' then
    if m->>'key' !~ '^catalog:[a-f0-9-]{36}:(warehouse|maintenance_consumable)$' then raise exception using errcode='22023',message='Vật tư bổ sung phải chọn từ danh mục'; end if;
    select * into catalog from public.materials where id=split_part(m->>'key',':',2)::uuid and workspace_id=p_workspace;
    if not found or catalog.code is distinct from m->>'catalogueCode' or catalog.name is distinct from m->>'name' or catalog.unit is distinct from m->>'unit' or split_part(m->>'key',':',3) is distinct from m->>'source' then
     raise exception using errcode='22023',message='Vật tư bổ sung không khớp danh mục'; end if;
   end if;
   amount:=(m->>'quantity')::numeric;
   if amount<=0 or amount>100000 or amount<>round(amount,3) then raise exception using errcode='22023',message='Sai số lượng'; end if;
  end loop;
  select case_id into cid from private.maintenance_requisition_cases where equipment_id=e.id and planned_day=p_planned_day;
  if cid is null then
   summary_text:='Kế hoạch bảo dưỡng '||p_planned_day::text||' · '||(r->>'maintenanceLevel');
   cid:=private.create_case(e.id,'maintenance',clock_timestamp(),null,summary_text,gen_random_uuid());
   update public.work_cases set tracking_only=true where id=cid;
   insert into public.repair_orders(equipment_id,code,title,case_id) values(e.id,'AUTO',summary_text,cid) returning id into oid;
   insert into public.repair_work_items(repair_order_id,item_no,symptom,solution_plan) values(oid,1,summary_text,'Theo kế hoạch đã lưu; chưa xác nhận thực hiện');
   insert into public.case_material_followups(case_id) values(cid);
   insert into private.maintenance_requisition_cases values(e.id,p_planned_day,cid);
  end if;
  saved_rows:=saved_rows||jsonb_build_array(r||jsonb_build_object('equipmentName',e.name,'caseId',cid,'caseCode',(select code from public.work_cases where id=cid)));
 end loop;
 if exists(select 1 from jsonb_array_elements(saved_rows) as x(row_data) cross join lateral jsonb_array_elements(x.row_data->'materials') as y(material)
  group by y.material->>'key',y.material->>'unit',coalesce(y.material->>'catalogueCode',''),y.material->>'source'
  having count(distinct y.material->>'name')>1 or sum((y.material->>'quantity')::numeric)>10000000) then
  raise exception using errcode='22023',message='Danh điểm hoặc tổng số lượng không nhất quán'; end if;
 insert into public.maintenance_requisition_runs(workspace_id,planned_day,grouping_mode,snapshot,created_by,fingerprint,document_day,voucher_kind,supplement_note,source_filename,source_sha256)
 values(p_workspace,p_planned_day,p_grouping,jsonb_build_object('version',1,'rows',saved_rows,'print',print_data),auth.uid(),fp,p_document_day,p_voucher_kind,clean_note,p_source_filename,p_source_sha256) returning id into rid;
 insert into private.maintenance_requisition_requests values(p_key,auth.uid(),fp,rid);
 return rid;
end; $function$
;

comment on function private.save_maintenance_requisition_v3(uuid,date,date,text,text,text,jsonb,jsonb,text,text,uuid)
 is 'Atomically saves a maintenance requisition and validated per-voucher print metadata.';

commit;


