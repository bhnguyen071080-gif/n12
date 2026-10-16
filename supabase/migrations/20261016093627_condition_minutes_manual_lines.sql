-- Allow document-only equipment/material inspection rows in technical minutes.
-- Preserve the existing role checks, source hash, immutable snapshots and retry keys.
begin;
create or replace function private.save_case_document(p_case uuid,p_kind text,p_payload jsonb,p_source_hash text,p_key uuid) returns uuid
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
 if exists(select 1 from jsonb_array_elements(p_payload->'lines') l where l->>'usage_id' is not null group by l->>'usage_id' having count(*)>1) then
 raise exception using errcode='22023',message='Vật tư trùng'; end if;
 for line in select value from jsonb_array_elements(p_payload->'lines') loop
  if jsonb_typeof(line)<>'object' or exists(select 1 from jsonb_object_keys(line) as keys(field) where field not in
  ('usage_id','name','specification','catalogue_code','unit','requested','issued','unit_price','limit_text','used_text','condition','notes')) then
  raise exception using errcode='22023',message='Sai trường vật tư'; end if;
  foreach k in array array['usage_id','name','specification','catalogue_code','unit','limit_text','used_text','condition','notes'] loop
   -- A null usage_id is a document-only inspection row, never a stock request.
   if k='usage_id' and p_kind='condition_minutes' and line->'usage_id'='null'::jsonb then continue; end if;
   max_length:=case when k='usage_id' then 36 when k in ('name','specification') then 500 when k='catalogue_code' then 100
    when k='unit' then 40 when k in ('limit_text','used_text') then 200 when k='notes' then 1000 else 4000 end;
   if jsonb_typeof(line->k) is distinct from 'string' or length(line->>k)>max_length
   or translate(line->>k,chr(9)||chr(10)||chr(13),'') ~ '[[:cntrl:]]' then raise exception using errcode='22023',message='Sai nội dung vật tư'; end if;
  end loop;
  if btrim(line->>'name')='' or btrim(line->>'unit')='' then raise exception using errcode='22023',message='Thiếu tên/đơn vị vật tư'; end if;
  if (line->>'usage_id' is not null and not exists(select 1 from jsonb_array_elements(env->'data'->'lines') l where l->>'usage_id'=line->>'usage_id'))
  or (line->>'usage_id' is null and p_kind<>'condition_minutes')
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
commit;
