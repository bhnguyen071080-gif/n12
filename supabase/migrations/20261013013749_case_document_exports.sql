-- Append-only print snapshots. No stock, progress, installation or return mutations.
begin;
create table public.case_documents(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id),
 case_id uuid not null references public.work_cases(id),kind text not null check(kind in ('condition_minutes','material_requisition')),
 revision integer not null check(revision>0),request_key uuid not null,created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),
 drive_file_id text check(drive_file_id ~ '^[A-Za-z0-9_-]{10,200}$'),
 drive_state text not null default 'pending' check(drive_state in ('pending','uploading','saved')),
 drive_lease uuid,drive_lease_until timestamptz,drive_pdf_sha256 text check(drive_pdf_sha256 ~ '^[a-f0-9]{64}$'),
 unique(case_id,kind,revision),unique(created_by,request_key),unique(drive_file_id),
 check((drive_state='uploading')=(drive_lease is not null and drive_lease_until is not null)),
 check(drive_state<>'saved' or (drive_file_id is not null and drive_pdf_sha256 is not null))
);
create index case_documents_workspace_idx on public.case_documents(workspace_id,created_at desc);
alter table public.case_documents enable row level security;
revoke all on public.case_documents from public,anon,authenticated;
grant select on public.case_documents to authenticated;
create function private.can_case_document(p_equipment uuid,p_kind text) returns boolean
language sql stable security definer set search_path='' as $$
 select p_kind in ('condition_minutes','material_requisition') and private.can_equipment(p_equipment,
 case when p_kind='condition_minutes' then array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]
 else array['KY_THUAT_VIEN','CAN_BO_VAT_TU','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[] end);
$$;
create policy case_documents_read on public.case_documents for select to authenticated using(
 exists(select 1 from public.work_cases c where c.id=case_documents.case_id and private.can_case_document(c.equipment_id,case_documents.kind)));
create function private.guard_case_document() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception using errcode='42501',message='Phiên bản hồ sơ không được xóa'; end if;
 if row(new.id,new.workspace_id,new.case_id,new.kind,new.revision,new.request_key,new.created_by,new.created_at,new.snapshot)
 is distinct from row(old.id,old.workspace_id,old.case_id,old.kind,old.revision,old.request_key,old.created_by,old.created_at,old.snapshot)
 or (old.drive_file_id is not null and new.drive_file_id is distinct from old.drive_file_id) then
 raise exception using errcode='42501',message='Phiên bản hồ sơ đã lưu không được ghi đè'; end if;
 return new;
end; $$;
create trigger case_document_guard before update or delete on public.case_documents for each row execute function private.guard_case_document();
create trigger audit_row after insert or update on public.case_documents for each row execute function private.audit_change();

create function private.case_document_source(p_case uuid,p_kind text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c public.work_cases;e public.equipment;r public.repair_orders;body jsonb;items jsonb;lines jsonb;
begin
 select * into c from public.work_cases where id=p_case and tracking_only;
 if c.id is null or not private.can_case_document(c.equipment_id,p_kind) then
 raise exception using errcode='42501',message='Không có quyền đọc nguồn hồ sơ'; end if;
 select * into strict e from public.equipment where id=c.equipment_id;
 select * into strict r from public.repair_orders where case_id=c.id;
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'item_no',i.item_no,'version',i.version_no,'performed_on',i.performed_on,
 'symptom',i.symptom,'root_cause',i.root_cause,'solution_plan',i.solution_plan,'execution_result',i.execution_result) order by i.item_no),'[]')
 into items from public.repair_work_items i where i.repair_order_id=r.id;
 select coalesce(jsonb_agg(jsonb_build_object('usage_id',u.id,'item_id',i.id,'item_no',i.item_no,'name',m.name,'code',m.code,'unit',m.unit,
 'quantity',u.quantity,'condition',i.symptom,'service_limit_hours',m.service_limit_hours,'supply_state',u.supply_state,
 'is_installed',u.is_installed,'performed_on',i.performed_on) order by i.item_no,u.id),'[]') into lines
 from public.repair_work_items i join public.repair_material_usages u on u.repair_work_item_id=i.id
 join public.materials m on m.id=u.material_id where i.repair_order_id=r.id;
 body:=jsonb_build_object('source',jsonb_build_object('case_id',c.id,'case_code',c.code,'order_code',r.code,
 'equipment_id',e.id,'equipment_code',e.code,'equipment_name',e.name),'summary',c.summary,'items',items,'lines',lines);
 return jsonb_build_object('workspace_id',e.workspace_id,'data',body,
 'source_hash',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(body::text,'UTF8')),'hex'));
end; $$;
create function public.get_case_document_source(p_case uuid,p_kind text) returns jsonb
language sql security invoker set search_path='' as $$select private.case_document_source(p_case,p_kind)$$;

create function private.save_case_document(p_case uuid,p_kind text,p_payload jsonb,p_source_hash text,p_key uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare env jsonb;prior public.case_documents;line jsonb;participant jsonb;k text;max_length integer;rev integer;result uuid;
 qty numeric;issued numeric;price numeric;sum_amount numeric:=0;
begin
 if p_key is null or p_payload is null or pg_catalog.octet_length(p_payload::text)>400000
 or jsonb_typeof(p_payload)<>'object' or p_payload->>'kind' is distinct from p_kind or p_payload->'schema_version' is distinct from '1'::jsonb then
 raise exception using errcode='22023',message='Sai nội dung biểu mẫu'; end if;
 if exists(select 1 from jsonb_object_keys(p_payload) as keys(field) where field not in
 ('schema_version','kind','company','department','unit','location','form_code','document_number','document_at','equipment_label','inspection_subject','reason','warehouse','participants','cause','solution','signer_names','amount_words','lines')) then
 raise exception using errcode='22023',message='Trường không thuộc biểu mẫu'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text||p_key::text,0));
 env:=private.case_document_source(p_case,p_kind);
 select * into prior from public.case_documents where created_by=auth.uid() and request_key=p_key;
 if found then
  if prior.case_id<>p_case or prior.kind<>p_kind or prior.snapshot->'payload'<>p_payload then
   raise exception using errcode='22023',message='Khóa lưu đã dùng cho nội dung khác'; end if;return prior.id;
 end if;
 if env->>'source_hash' is distinct from p_source_hash then
 raise exception using errcode='40001',message='Nguồn vụ việc đã thay đổi; tải lại trước khi xuất'; end if;
 foreach k in array array['company','department','unit','location','document_at','equipment_label','inspection_subject','reason','warehouse','form_code','document_number','cause','solution','amount_words'] loop
  max_length:=case when k in ('company','department','unit','location','warehouse') then 200 when k='document_at' then 16
   when k='equipment_label' then 300 when k in ('inspection_subject','reason') then 1500 when k='form_code' then 50
   when k='document_number' then 100 when k='amount_words' then 1000 else 8000 end;
  if jsonb_typeof(p_payload->k) is distinct from 'string' or length(p_payload->>k)>max_length
  or translate(p_payload->>k,chr(9)||chr(10)||chr(13),'') ~ '[[:cntrl:]]' then
  raise exception using errcode='22023',message='Thiếu hoặc sai trường biểu mẫu'; end if;
 end loop;
 if btrim(p_payload->>'company')='' or btrim(p_payload->>'department')='' or btrim(p_payload->>'unit')='' or btrim(p_payload->>'location')=''
 or btrim(p_payload->>'equipment_label')='' or (p_payload->>'document_at') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$' then
 raise exception using errcode='22023',message='Thiếu thông tin đơn vị/ngày giờ'; end if;
 perform (p_payload->>'document_at')::timestamp;
 if jsonb_typeof(p_payload->'participants') is distinct from 'array' or jsonb_array_length(p_payload->'participants')>3
 or jsonb_typeof(p_payload->'signer_names') is distinct from 'array' or jsonb_array_length(p_payload->'signer_names')<>5
 or jsonb_typeof(p_payload->'lines') is distinct from 'array' or jsonb_array_length(p_payload->'lines')>150
 or (p_kind='material_requisition' and jsonb_array_length(p_payload->'lines')=0) then
 raise exception using errcode='22023',message='Sai danh sách biểu mẫu'; end if;
 for participant in select value from jsonb_array_elements(p_payload->'participants') loop
  if jsonb_typeof(participant)<>'object' or jsonb_typeof(participant->'unit') is distinct from 'string'
  or jsonb_typeof(participant->'members') is distinct from 'string' or length(participant->>'unit')>200 or length(participant->>'members')>1000
  or exists(select 1 from jsonb_object_keys(participant) as keys(field) where field not in ('unit','members')) then
  raise exception using errcode='22023',message='Sai thành phần tham gia'; end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(p_payload->'signer_names') n where jsonb_typeof(n)<>'string' or length(n#>>'{}')>100) then
 raise exception using errcode='22023',message='Sai họ tên người ký'; end if;
 if exists(select 1 from jsonb_array_elements(p_payload->'lines') l group by l->>'usage_id' having count(*)>1) then
 raise exception using errcode='22023',message='Vật tư trùng'; end if;
 for line in select value from jsonb_array_elements(p_payload->'lines') loop
  if jsonb_typeof(line)<>'object' or exists(select 1 from jsonb_object_keys(line) as keys(field) where field not in
  ('usage_id','name','specification','catalogue_code','unit','requested','issued','unit_price','limit_text','used_text','condition','notes')) then
  raise exception using errcode='22023',message='Sai trường vật tư'; end if;
  foreach k in array array['usage_id','name','specification','catalogue_code','unit','limit_text','used_text','condition','notes'] loop
   max_length:=case when k='usage_id' then 36 when k in ('name','specification') then 500 when k='catalogue_code' then 100
    when k='unit' then 40 when k in ('limit_text','used_text') then 200 when k='notes' then 1000 else 4000 end;
   if jsonb_typeof(line->k) is distinct from 'string' or length(line->>k)>max_length
   or translate(line->>k,chr(9)||chr(10)||chr(13),'') ~ '[[:cntrl:]]' then raise exception using errcode='22023',message='Sai nội dung vật tư'; end if;
  end loop;
  if btrim(line->>'name')='' or btrim(line->>'unit')='' then raise exception using errcode='22023',message='Thiếu tên/đơn vị vật tư'; end if;
  if not exists(select 1 from jsonb_array_elements(env->'data'->'lines') l where l->>'usage_id'=line->>'usage_id')
  or jsonb_typeof(line->'requested') is distinct from 'number' or (line->>'requested')::numeric<=0
  or (line->>'requested')::numeric>10000000 then
  raise exception using errcode='22023',message='Vật tư/số xin lĩnh không thuộc vụ việc'; end if;
  qty:=(line->>'requested')::numeric;
  if qty<>round(qty,3) or jsonb_typeof(line->'issued') is null or jsonb_typeof(line->'issued') not in ('number','null')
  or jsonb_typeof(line->'unit_price') is null or jsonb_typeof(line->'unit_price') not in ('number','null') then
  raise exception using errcode='22023',message='Sai số lượng/đơn giá'; end if;
  issued:=(line->>'issued')::numeric;price:=(line->>'unit_price')::numeric;
  if issued<0 or issued>10000000 or issued<>round(issued,3) or price<0 or price>1000000000000 or price<>round(price)
  or (issued is not null and price is not null and round(issued*price)>9007199254740991) then
  raise exception using errcode='22023',message='Số lượng/đơn giá vượt giới hạn'; end if;
  sum_amount:=sum_amount+coalesce(round(issued*price),0);
 end loop;
 if sum_amount>9007199254740991 then raise exception using errcode='22023',message='Tổng tiền vượt giới hạn'; end if;
 perform 1 from public.work_cases where id=p_case for update;
 select coalesce(max(revision),0)+1 into rev from public.case_documents where case_id=p_case and kind=p_kind;
 insert into public.case_documents(workspace_id,case_id,kind,revision,request_key,created_by,snapshot)
 values((env->>'workspace_id')::uuid,p_case,p_kind,rev,p_key,auth.uid(),jsonb_build_object('payload',p_payload,
 'source',env->'data'->'source','source_hash',p_source_hash,'layout_version','tv-eam-print-1')) returning id into result;
 return result;
end; $$;
create function public.save_case_document(p_case uuid,p_kind text,p_payload jsonb,p_source_hash text,p_key uuid) returns uuid
language sql security invoker set search_path='' as $$select private.save_case_document(p_case,p_kind,p_payload,p_source_hash,p_key)$$;

create function private.claim_document_drive(p_document uuid,p_file_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d public.case_documents;e uuid;
begin
 select * into d from public.case_documents where id=p_document for update;
 select equipment_id into e from public.work_cases where id=d.case_id;
 if d.id is null or not private.can_case_document(e,d.kind) then raise exception using errcode='42501',message='Không có quyền lưu hồ sơ'; end if;
 if d.drive_state='saved' then return to_jsonb(d); end if;
 if d.drive_state='uploading' and d.drive_lease_until>now() then raise exception using errcode='40001',message='Đang lưu lên Drive, thử lại sau'; end if;
 if p_file_id is null or p_file_id !~ '^[A-Za-z0-9_-]{10,200}$' then raise exception using errcode='22023',message='Sai định danh tệp'; end if;
 update public.case_documents set drive_file_id=coalesce(drive_file_id,p_file_id),drive_state='uploading',drive_lease=gen_random_uuid(),drive_lease_until=now()+interval '5 minutes'
 where id=p_document returning * into d;return to_jsonb(d);
end; $$;
create function public.claim_document_drive(p_document uuid,p_file_id text) returns jsonb
language sql security invoker set search_path='' as $$select private.claim_document_drive(p_document,p_file_id)$$;
create function private.finish_document_drive(p_document uuid,p_lease uuid,p_sha256 text,p_actor uuid) returns void
language plpgsql security definer set search_path='' as $$
declare d public.case_documents;e uuid;previous_actor text;
begin
 select * into d from public.case_documents where id=p_document for update;
 select equipment_id into e from public.work_cases where id=d.case_id;
 if d.id is null or p_actor is null or not exists(select 1 from public.workspace_memberships m join public.equipment eq on eq.workspace_id=m.workspace_id
 where eq.id=e and m.user_id=p_actor and m.active and m.role=any(
 case when d.kind='condition_minutes' then array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]
 else array['KY_THUAT_VIEN','CAN_BO_VAT_TU','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[] end)) then
 raise exception using errcode='42501',message='Không có quyền xác nhận lưu hồ sơ'; end if;
 if d.drive_state<>'uploading' or d.drive_lease is distinct from p_lease or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' then
 raise exception using errcode='40001',message='Lượt lưu Drive đã thay đổi'; end if;
 previous_actor:=pg_catalog.current_setting('request.jwt.claim.sub',true);
 perform pg_catalog.set_config('request.jwt.claim.sub',p_actor::text,true);
 update public.case_documents set drive_state='saved',drive_lease=null,drive_lease_until=null,drive_pdf_sha256=p_sha256 where id=p_document;
 perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(previous_actor,''),true);
end; $$;
create function public.finish_document_drive(p_document uuid,p_lease uuid,p_sha256 text,p_actor uuid) returns void
language sql security invoker set search_path='' as $$select private.finish_document_drive(p_document,p_lease,p_sha256,p_actor)$$;
create function private.release_document_drive(p_document uuid,p_lease uuid) returns void
language plpgsql security definer set search_path='' as $$
declare d public.case_documents;e uuid;
begin
 select * into d from public.case_documents where id=p_document for update;
 select equipment_id into e from public.work_cases where id=d.case_id;
 if d.id is null or not private.can_case_document(e,d.kind) then raise exception using errcode='42501',message='Không có quyền lưu hồ sơ'; end if;
 update public.case_documents set drive_state='pending',drive_lease=null,drive_lease_until=null
 where id=p_document and drive_state='uploading' and drive_lease=p_lease;
end; $$;
create function public.release_document_drive(p_document uuid,p_lease uuid) returns void
language sql security invoker set search_path='' as $$select private.release_document_drive(p_document,p_lease)$$;
revoke execute on function private.can_case_document(uuid,text),private.case_document_source(uuid,text),public.get_case_document_source(uuid,text),
 private.save_case_document(uuid,text,jsonb,text,uuid),public.save_case_document(uuid,text,jsonb,text,uuid),
 private.claim_document_drive(uuid,text),public.claim_document_drive(uuid,text),
 private.release_document_drive(uuid,uuid),public.release_document_drive(uuid,uuid) from public,anon;
grant execute on function private.can_case_document(uuid,text),private.case_document_source(uuid,text),public.get_case_document_source(uuid,text),
 private.save_case_document(uuid,text,jsonb,text,uuid),public.save_case_document(uuid,text,jsonb,text,uuid),
 private.claim_document_drive(uuid,text),public.claim_document_drive(uuid,text),
 private.release_document_drive(uuid,uuid),public.release_document_drive(uuid,uuid) to authenticated;
-- Only the server that verifies the Drive upload may confirm an external archive.
revoke execute on function private.finish_document_drive(uuid,uuid,text,uuid),public.finish_document_drive(uuid,uuid,text,uuid) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.finish_document_drive(uuid,uuid,text,uuid),public.finish_document_drive(uuid,uuid,text,uuid) to service_role;
commit;
