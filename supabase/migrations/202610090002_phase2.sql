begin;
create type public.case_kind as enum ('repair','maintenance','cleaning','inspection');
create table private.case_counters (
 equipment_id uuid not null references public.equipment(id), kind public.case_kind not null,
 actual_day date not null, last_value bigint not null, primary key(equipment_id,kind,actual_day)
);
create table public.work_cases (
 id uuid primary key default gen_random_uuid(), equipment_id uuid not null references public.equipment(id),
 kind public.case_kind not null, code text not null,
 actual_started_at timestamptz not null, actual_ended_at timestamptz,
 summary text not null, submitted_at timestamptz, parent_case_id uuid references public.work_cases(id),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 request_key uuid not null unique, request_fingerprint text not null,
 unique(equipment_id,code),
 check(actual_ended_at is null or actual_ended_at>=actual_started_at),
 check(length(btrim(summary))>0)
);
alter table public.repair_orders add column case_id uuid unique references public.work_cases(id);
create table public.case_checks (
 id uuid primary key default gen_random_uuid(), case_id uuid not null references public.work_cases(id),
 item_no integer not null check(item_no>0), label text not null, abnormal boolean not null default false,
 notes text not null default '', unique(case_id,item_no),
 check(not abnormal or length(btrim(notes))>0)
);
create table public.monthly_production (
 id uuid primary key default gen_random_uuid(), equipment_id uuid not null references public.equipment(id),
 month date not null check(extract(day from month)=1),
 boxes bigint not null check(boxes>=0), teu numeric(18,2) not null check(teu>=0),
 updated_by uuid not null default auth.uid() references auth.users(id),
 updated_at timestamptz not null default now(), unique(equipment_id,month)
);
create table public.monthly_operating_hours (
 id uuid primary key default gen_random_uuid(), equipment_id uuid not null references public.equipment(id),
 month date not null check(extract(day from month)=1),
 operating_hours numeric(18,2) not null check(operating_hours>=0),
 updated_by uuid not null default auth.uid() references auth.users(id),
 updated_at timestamptz not null default now(), unique(equipment_id,month),
 check(operating_hours <= extract(day from (month+interval '1 month'-interval '1 day'))*24)
);
create table private.import_requests (
 workspace_id uuid not null references public.workspaces(id), request_key uuid not null,
 actor_id uuid not null references auth.users(id), fingerprint text not null, row_count integer not null,
 primary key(workspace_id,request_key)
);
create table public.maintenance_plans (
 id uuid primary key default gen_random_uuid(), equipment_id uuid not null references public.equipment(id),
 name text not null, interval_hours numeric(18,2) check(interval_hours>0),
 interval_days integer check(interval_days>0), anchor_hours numeric(18,2) not null check(anchor_hours>=0),
 anchor_date date not null, warning_hours numeric(18,2) not null default 25 check(warning_hours>=0),
 warning_days integer not null default 7 check(warning_days>=0),
 active boolean not null default true, check(interval_hours is not null or interval_days is not null)
);
create table public.maintenance_events (
 id uuid primary key default gen_random_uuid(), plan_id uuid not null references public.maintenance_plans(id),
 case_id uuid not null unique references public.work_cases(id), meter_hours numeric(18,2) not null check(meter_hours>=0),
 execution_result text not null, check(length(btrim(execution_result))>0)
);
create table public.technical_documents (
 id uuid primary key default gen_random_uuid(), equipment_id uuid not null references public.equipment(id),
 order_id uuid references public.repair_orders(id), case_id uuid references public.work_cases(id),
 kind text not null check(kind in ('drawing_electrical','drawing_hydraulic','plc','vfd','incident','photo_before','photo_after','material_voucher')),
 file_name text not null check(file_name ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,149}$'),
 storage_path text not null unique,
 mime_type text not null, byte_size bigint not null check(byte_size>0 and byte_size<=20971520),
 status text not null default 'pending' check(status in ('pending','ready','archived')),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now()
);
create table public.audit_logs (
 id bigint generated always as identity primary key, workspace_id uuid references public.workspaces(id),
 actor_id uuid, actor_kind text not null check(actor_kind in ('user','system')),
 table_name text not null, record_id uuid, operation text not null check(operation in ('INSERT','UPDATE','DELETE')),
 old_data jsonb,new_data jsonb, occurred_at timestamptz not null default clock_timestamp()
);
create index memberships_user_idx on public.workspace_memberships(user_id,workspace_id) where active;
create index equipment_workspace_idx on public.equipment(workspace_id);
create index repair_orders_equipment_idx on public.repair_orders(equipment_id,opened_at desc);
create index items_order_idx on public.repair_work_items(repair_order_id);
create index usages_item_idx on public.repair_material_usages(repair_work_item_id);
create index cases_equipment_date_idx on public.work_cases(equipment_id,actual_started_at desc);
create index cases_parent_idx on public.work_cases(parent_case_id);
create index plans_equipment_idx on public.maintenance_plans(equipment_id) where active;
create index events_plan_idx on public.maintenance_events(plan_id);
create index documents_equipment_idx on public.technical_documents(equipment_id);
create index audit_workspace_time_idx on public.audit_logs(workspace_id,occurred_at desc);
create index voucher_lines_material_idx on public.voucher_lines(material_id);
create index voucher_lines_usage_idx on public.voucher_lines(usage_id);
create unique index one_repair_from_case on public.work_cases(parent_case_id) where kind='repair' and parent_case_id is not null;

create function private.case_readable(p_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.work_cases c where c.id=p_id and (
  private.can_equipment(c.equipment_id,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[])
  or (c.created_by=auth.uid() and private.can_equipment(c.equipment_id,array['DOI_SAN_XUAT']::public.eam_role[]))
  or (c.kind='repair' and private.can_equipment(c.equipment_id,array['CAN_BO_VAT_TU']::public.eam_role[]))
 ));
$$;
create function private.create_case(p_equipment uuid,p_kind public.case_kind,p_started timestamptz,
 p_ended timestamptz,p_summary text,p_key uuid,p_parent uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare e public.equipment; existing public.work_cases; cid uuid:=gen_random_uuid();
 d date; n bigint; prefix text; fp text; oid uuid;
begin
 if not private.can_equipment(p_equipment,array['DOI_SAN_XUAT','KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[])
 or (p_kind='maintenance' and not private.can_equipment(p_equipment,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]))
 then raise exception using errcode='42501',message='Không được tạo vụ việc này'; end if;
 if p_started is null or p_key is null or p_summary is null or length(btrim(p_summary))=0
 or (p_ended is not null and p_ended<p_started) then
  raise exception using errcode='22023',message='Thời gian hoặc nội dung vụ việc không hợp lệ';
 end if;
 if p_parent is not null and not exists(
  select 1 from public.work_cases c where c.id=p_parent and c.equipment_id=p_equipment and private.case_readable(c.id)
 ) then raise exception using errcode='42501',message='Vụ việc nguồn không hợp lệ'; end if;
 -- Lock the equipment before checking the request: concurrent retries serialize.
 select * into strict e from public.equipment where id=p_equipment for update;
 fp:=md5(jsonb_build_array(p_equipment,p_kind,p_started,p_ended,p_summary,p_parent)::text);
 select * into existing from public.work_cases where request_key=p_key;
 if found then
  if existing.created_by<>auth.uid() or existing.request_fingerprint<>fp then
   raise exception using errcode='22023',message='Khóa yêu cầu đã dùng cho nội dung khác';
  end if;
  return existing.id;
 end if;
 d:=(p_started at time zone 'Asia/Bangkok')::date;
 insert into private.case_counters values(p_equipment,p_kind,d,1)
 on conflict(equipment_id,kind,actual_day) do update set last_value=private.case_counters.last_value+1
 returning last_value into n;
 prefix:=case p_kind when 'repair' then 'SC' when 'maintenance' then 'BD' when 'cleaning' then 'VS' else 'KT' end;
 insert into public.work_cases(id,equipment_id,kind,code,actual_started_at,actual_ended_at,summary,created_by,request_key,request_fingerprint,parent_case_id)
 values(cid,p_equipment,p_kind,prefix||'-'||e.code||'-'||to_char(p_started at time zone 'Asia/Bangkok','YYYYMMDD-HH24MISS')||'-'||lpad(n::text,greatest(4,length(n::text)),'0'),
 p_started,p_ended,btrim(p_summary),auth.uid(),p_key,fp,p_parent);
 if p_kind='repair' then
  insert into public.repair_orders(equipment_id,code,title,case_id) values(p_equipment,'AUTO',p_summary,cid) returning id into oid;
  insert into public.repair_work_items(repair_order_id,item_no,symptom) values(oid,1,p_summary);
 end if;
 return cid;
end; $$;
create function public.create_work_case(p_equipment uuid,p_kind public.case_kind,p_started timestamptz,
 p_ended timestamptz,p_summary text,p_key uuid)
returns uuid language sql security invoker set search_path='' as $$
 select private.create_case(p_equipment,p_kind,p_started,p_ended,p_summary,p_key);
$$;

create function private.guard_case()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.id<>old.id or new.equipment_id<>old.equipment_id or new.kind<>old.kind or new.code<>old.code
 or new.created_by<>old.created_by or new.request_key<>old.request_key or new.parent_case_id is distinct from old.parent_case_id
 or new.request_fingerprint<>old.request_fingerprint then
  raise exception using errcode='42501',message='Mã và liên kết vụ việc là bất biến';
 end if;
 if old.submitted_at is not null and current_user<>'postgres' then
  raise exception using errcode='22023',message='Phiếu đã gửi, không được sửa trực tiếp';
 end if;
 if new.submitted_at is not null and old.submitted_at is null then new.submitted_at:=now(); end if;
 return new;
end; $$;
create trigger case_guard before update on public.work_cases for each row execute function private.guard_case();
create function private.guard_case_check()
returns trigger language plpgsql security definer set search_path='' as $$
declare c public.work_cases;
begin
 select * into strict c from public.work_cases where id=coalesce(new.case_id,old.case_id) for update;
 if c.kind<>'inspection' or c.submitted_at is not null then
  raise exception using errcode='22023',message='Chỉ sửa nội dung vụ kiểm tra chưa gửi';
 end if;
 if tg_op='UPDATE' and (new.id<>old.id or new.case_id<>old.case_id or new.item_no<>old.item_no) then
  raise exception using errcode='42501',message='Không được đổi liên kết mục kiểm tra';
 end if;
 return case when tg_op='DELETE' then old else new end;
end; $$;
create trigger case_check_guard before insert or update or delete on public.case_checks for each row execute function private.guard_case_check();

create function private.convert_case(p_case uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.work_cases; child uuid; oid uuid; symptom_text text;
begin
 select * into strict c from public.work_cases where id=p_case for update;
 if not private.case_readable(c.id) or c.kind<>'inspection' or c.submitted_at is null then
  raise exception using errcode='42501',message='Chỉ chuyển vụ kiểm tra đã gửi và có quyền truy cập';
 end if;
 select r.id into oid from public.repair_orders r join public.work_cases wc on wc.id=r.case_id where wc.parent_case_id=c.id;
 if found then return oid; end if;
 select string_agg(label||': '||notes,E'\n' order by item_no) into symptom_text
 from public.case_checks where case_id=c.id and abnormal;
 if symptom_text is null then raise exception using errcode='22023',message='Phiếu không có bất thường'; end if;
 child:=private.create_case(c.equipment_id,'repair',c.actual_started_at,null,symptom_text,gen_random_uuid(),c.id);
 select id into strict oid from public.repair_orders where case_id=child;
 return oid;
end; $$;
create function public.convert_inspection_to_repair(p_case uuid)
returns uuid language sql security invoker set search_path='' as $$ select private.convert_case(p_case); $$;

create function private.guard_order_case()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and new.case_id is distinct from old.case_id then
  raise exception using errcode='42501',message='Không được đổi mã vụ việc nguồn';
 end if;
 if new.case_id is not null and not exists(select 1 from public.work_cases c
 where c.id=new.case_id and c.kind='repair' and c.equipment_id=new.equipment_id) then
  raise exception using errcode='22023',message='Vụ việc sửa chữa không cùng phương tiện';
 end if;
 return new;
end; $$;
create trigger order_case_guard before insert or update on public.repair_orders for each row execute function private.guard_order_case();

create function private.lock_monthly_equipment()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.equipment where id in (
  case when tg_op<>'DELETE' then new.equipment_id end,
  case when tg_op<>'INSERT' then old.equipment_id end
 ) order by id for update;
 if tg_op<>'DELETE' then new.updated_by:=auth.uid(); new.updated_at:=now(); end if;
 return case when tg_op='DELETE' then old else new end;
end; $$;
create function private.apply_monthly_hours()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op<>'INSERT' then update public.equipment set accumulated_hours=accumulated_hours-old.operating_hours where id=old.equipment_id; end if;
 if tg_op<>'DELETE' then update public.equipment set accumulated_hours=accumulated_hours+new.operating_hours where id=new.equipment_id; end if;
 return case when tg_op='DELETE' then old else new end;
end; $$;
create trigger monthly_hours_lock before insert or update or delete on public.monthly_operating_hours for each row execute function private.lock_monthly_equipment();
create trigger monthly_hours_accumulate after insert or update or delete on public.monthly_operating_hours for each row execute function private.apply_monthly_hours();
create trigger monthly_production_stamp before insert or update on public.monthly_production for each row execute function private.lock_monthly_equipment();

create function private.import_monthly(p_workspace uuid,p_rows jsonb,p_key uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare fp text; prior private.import_requests; cnt integer;
begin
 if not private.has_role(p_workspace,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then
  raise exception using errcode='42501',message='Không có quyền nhập số liệu tháng'; end if;
 if p_rows is null or jsonb_typeof(p_rows)<>'array' or p_key is null or jsonb_array_length(p_rows) not between 1 and 1000 then
  raise exception using errcode='22023',message='Import phải có 1–1000 dòng'; end if;
 perform 1 from public.workspaces where id=p_workspace for update;
 fp:=md5(p_rows::text);
 select * into prior from private.import_requests where workspace_id=p_workspace and request_key=p_key;
 if found then
  if prior.actor_id<>auth.uid() or prior.fingerprint<>fp then
   raise exception using errcode='22023',message='Khóa import đã dùng cho dữ liệu khác'; end if;
  return prior.row_count;
 end if;
 if exists(select 1 from jsonb_to_recordset(p_rows) as r(equipment_code text,month date,boxes bigint,teu numeric,operating_hours numeric)
  where month is null or extract(day from month)<>1 or equipment_code is null or boxes is null or teu is null or operating_hours is null
   or boxes<0 or teu<0 or operating_hours<0) then
  raise exception using errcode='22023',message='Có dòng thiếu hoặc sai số liệu';
 end if;
 if exists(select 1 from jsonb_to_recordset(p_rows) as r(equipment_code text,month date) group by equipment_code,month having count(*)>1) then
  raise exception using errcode='22023',message='Trùng phương tiện và tháng trong import'; end if;
 select count(*) into cnt from jsonb_to_recordset(p_rows) as r(equipment_code text) join public.equipment e on e.workspace_id=p_workspace and e.code=r.equipment_code;
 if cnt<>jsonb_array_length(p_rows) then raise exception using errcode='22023',message='Có mã PTTB không thuộc workspace'; end if;
 -- Locks in deterministic order also serialize with direct monthly edits.
 perform 1 from public.equipment where workspace_id=p_workspace and code in (
  select equipment_code from jsonb_to_recordset(p_rows) as r(equipment_code text)
 ) order by id for update;
 insert into public.monthly_production(equipment_id,month,boxes,teu)
 select e.id,r.month,r.boxes,r.teu from jsonb_to_recordset(p_rows) as r(equipment_code text,month date,boxes bigint,teu numeric)
 join public.equipment e on e.workspace_id=p_workspace and e.code=r.equipment_code
 on conflict(equipment_id,month) do update set boxes=excluded.boxes,teu=excluded.teu;
 insert into public.monthly_operating_hours(equipment_id,month,operating_hours)
 select e.id,r.month,r.operating_hours from jsonb_to_recordset(p_rows) as r(equipment_code text,month date,operating_hours numeric)
 join public.equipment e on e.workspace_id=p_workspace and e.code=r.equipment_code
 on conflict(equipment_id,month) do update set operating_hours=excluded.operating_hours;
 insert into private.import_requests values(p_workspace,p_key,auth.uid(),fp,cnt);
 return cnt;
end; $$;
create function public.import_monthly_metrics(p_workspace uuid,p_rows jsonb,p_key uuid)
returns integer language sql security invoker set search_path='' as $$ select private.import_monthly(p_workspace,p_rows,p_key); $$;

create function private.guard_maintenance()
returns trigger language plpgsql security definer set search_path='' as $$
declare p public.maintenance_plans; c public.work_cases; hours numeric;
begin
 select * into strict p from public.maintenance_plans where id=new.plan_id;
 select * into strict c from public.work_cases where id=new.case_id;
 select accumulated_hours into strict hours from public.equipment where id=p.equipment_id;
 if c.kind<>'maintenance' or c.equipment_id<>p.equipment_id or c.actual_ended_at is null or new.meter_hours>hours then
  raise exception using errcode='22023',message='Vụ bảo dưỡng/giờ máy/thời gian kết thúc không hợp lệ';
 end if;
 if tg_op='UPDATE' and (new.id<>old.id or new.plan_id<>old.plan_id or new.case_id<>old.case_id) then
  raise exception using errcode='42501',message='Không được chuyển lần bảo dưỡng sang kế hoạch khác'; end if;
 return new;
end; $$;
create trigger maintenance_guard before insert or update on public.maintenance_events for each row execute function private.guard_maintenance();

create function private.document_permission(p_id uuid,p_write boolean)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.technical_documents d where d.id=p_id and d.status<>'archived' and (
 private.can_equipment(d.equipment_id,array['TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) or
 (private.can_equipment(d.equipment_id,array['KY_THUAT_VIEN']::public.eam_role[]) and d.kind<>'material_voucher') or
 (private.can_equipment(d.equipment_id,array['CAN_BO_VAT_TU']::public.eam_role[]) and d.kind='material_voucher') or
 (d.created_by=auth.uid() and d.kind in ('incident','photo_before','photo_after') and private.can_equipment(d.equipment_id,array['DOI_SAN_XUAT']::public.eam_role[]))
 ) and (not p_write or d.status='pending'));
$$;
create function private.storage_permission(p_name text,p_write boolean)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.technical_documents d where d.storage_path=p_name and private.document_permission(d.id,p_write));
$$;
create function private.guard_document()
returns trigger language plpgsql security definer set search_path='' as $$
declare e public.equipment; order_code text:='_equipment'; allowed boolean;
begin
 select * into strict e from public.equipment where id=new.equipment_id;
 if new.order_id is not null then
  select code into strict order_code from public.repair_orders where id=new.order_id and equipment_id=e.id;
 end if;
 if new.case_id is not null and not exists(select 1 from public.work_cases where id=new.case_id and equipment_id=e.id) then
  raise exception using errcode='22023',message='Vụ việc tài liệu không cùng PTTB'; end if;
 allowed:=private.can_equipment(e.id,array['TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) or
  (new.kind<>'material_voucher' and private.can_equipment(e.id,array['KY_THUAT_VIEN']::public.eam_role[])) or
  (new.kind='material_voucher' and private.can_equipment(e.id,array['CAN_BO_VAT_TU']::public.eam_role[])) or
  (new.kind in ('incident','photo_before','photo_after') and private.can_equipment(e.id,array['DOI_SAN_XUAT']::public.eam_role[]));
 if not allowed then raise exception using errcode='42501',message='Không có quyền loại tài liệu này'; end if;
 if tg_op='INSERT' then
  new.created_by:=auth.uid(); new.status:='pending';
  new.storage_path:=e.workspace_id||'/'||e.code||'/'||order_code||'/'||new.id||'/'||new.file_name;
 else
  if row(new.id,new.equipment_id,new.order_id,new.case_id,new.kind,new.file_name,new.storage_path,new.mime_type,new.byte_size,new.created_by,new.created_at)
   is distinct from row(old.id,old.equipment_id,old.order_id,old.case_id,old.kind,old.file_name,old.storage_path,old.mime_type,old.byte_size,old.created_by,old.created_at) then
   raise exception using errcode='42501',message='Metadata file là bất biến; tạo bản mới để thay thế'; end if;
  if old.status='ready' and new.status not in ('ready','archived') or old.status='archived' and new.status<>'archived' then
   raise exception using errcode='22023',message='Không được tái sử dụng đường dẫn file'; end if;
  if new.status='ready' and not exists(select 1 from storage.objects o where o.bucket_id='eam-documents' and o.name=new.storage_path) then
   raise exception using errcode='22023',message='Chưa tải file lên Storage'; end if;
 end if;
 if new.mime_type not in ('application/pdf','image/jpeg','image/png','image/webp','application/zip','application/octet-stream','text/plain') then
  raise exception using errcode='22023',message='Định dạng file không được hỗ trợ'; end if;
 return new;
end; $$;
create trigger document_guard before insert or update on public.technical_documents for each row execute function private.guard_document();

create function private.audit_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare before_row jsonb; after_row jsonb; row_data jsonb; w uuid; eid uuid; oid uuid; iid uuid; cid uuid; pid uuid;
begin
 if tg_op='UPDATE' and new is not distinct from old then return new; end if;
 if tg_op<>'INSERT' then before_row:=to_jsonb(old); end if;
 if tg_op<>'DELETE' then after_row:=to_jsonb(new); end if;
 row_data:=coalesce(after_row,before_row);
 w:=(row_data->>'workspace_id')::uuid;
 eid:=(row_data->>'equipment_id')::uuid;
 oid:=(row_data->>'repair_order_id')::uuid;
 iid:=(row_data->>'repair_work_item_id')::uuid;
 cid:=(row_data->>'case_id')::uuid;
 pid:=(row_data->>'plan_id')::uuid;
 if tg_table_name='equipment' then eid:=(row_data->>'id')::uuid; end if;
 if iid is not null then select repair_order_id into oid from public.repair_work_items where id=iid; end if;
 if oid is not null then select equipment_id into eid from public.repair_orders where id=oid; end if;
 if cid is not null then select equipment_id into eid from public.work_cases where id=cid; end if;
 if pid is not null then select equipment_id into eid from public.maintenance_plans where id=pid; end if;
 if eid is not null then select workspace_id into w from public.equipment where id=eid; end if;
 if tg_table_name='vouchers' then select workspace_id into w from public.warehouses where id=(row_data->>'warehouse_id')::uuid; end if;
 if tg_table_name='voucher_lines' then select wh.workspace_id into w from public.vouchers v join public.warehouses wh on wh.id=v.warehouse_id where v.id=(row_data->>'voucher_id')::uuid; end if;
 insert into public.audit_logs(workspace_id,actor_id,actor_kind,table_name,record_id,operation,old_data,new_data)
 values(w,auth.uid(),case when auth.uid() is null then 'system' else 'user' end,tg_table_name,(row_data->>'id')::uuid,tg_op,before_row,after_row);
 return case when tg_op='DELETE' then old else new end;
end; $$;
do $$ declare t text; begin
 foreach t in array array['workspace_memberships','equipment','equipment_specs','repair_orders','repair_work_items','materials','warehouses','repair_material_usages','vouchers','voucher_lines','equipment_downtimes','work_cases','case_checks','monthly_production','monthly_operating_hours','maintenance_plans','maintenance_events','technical_documents'] loop
  execute format('create trigger audit_row after insert or update or delete on public.%I for each row execute function private.audit_change()',t);
 end loop;
end; $$;

-- READ/CREATE/UPDATE/DELETE policies: no policy means deny that operation.
do $$ declare t text; begin
 foreach t in array array['work_cases','case_checks','monthly_production','monthly_operating_hours','maintenance_plans','maintenance_events','technical_documents','audit_logs'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end; $$;
create policy cases_read on public.work_cases for select to authenticated using(private.case_readable(id));
create policy cases_update on public.work_cases for update to authenticated using(
 submitted_at is null and (created_by=auth.uid() or private.can_equipment(equipment_id,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]))
 and private.can_equipment(equipment_id,array['DOI_SAN_XUAT','KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]))
 with check(private.can_equipment(equipment_id,array['DOI_SAN_XUAT','KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]));
grant update on public.work_cases to authenticated;
create policy checks_read on public.case_checks for select to authenticated using(private.case_readable(case_id));
create policy checks_write on public.case_checks for all to authenticated using(
 exists(select 1 from public.work_cases c where c.id=case_id and c.submitted_at is null and (
 c.created_by=auth.uid() or private.can_equipment(c.equipment_id,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]))))
 with check(exists(select 1 from public.work_cases c where c.id=case_id and c.submitted_at is null and (
 c.created_by=auth.uid() or private.can_equipment(c.equipment_id,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]))));
grant insert,update,delete on public.case_checks to authenticated;
do $$ declare t text; begin
 foreach t in array array['monthly_production','monthly_operating_hours','maintenance_plans'] loop
  execute format('create policy technical_read on public.%I for select to authenticated using(private.can_equipment(equipment_id,array[''KY_THUAT_VIEN'',''TRUONG_BO_PHAN_KY_THUAT'']::public.eam_role[]))',t);
  execute format('create policy technical_insert on public.%I for insert to authenticated with check(private.can_equipment(equipment_id,array[''KY_THUAT_VIEN'',''TRUONG_BO_PHAN_KY_THUAT'']::public.eam_role[]))',t);
  execute format('create policy technical_update on public.%I for update to authenticated using(private.can_equipment(equipment_id,array[''KY_THUAT_VIEN'',''TRUONG_BO_PHAN_KY_THUAT'']::public.eam_role[])) with check(private.can_equipment(equipment_id,array[''KY_THUAT_VIEN'',''TRUONG_BO_PHAN_KY_THUAT'']::public.eam_role[]))',t);
  execute format('grant insert,update on public.%I to authenticated',t);
 end loop;
 foreach t in array array['monthly_production','monthly_operating_hours'] loop
  execute format('create policy monthly_delete on public.%I for delete to authenticated using(private.can_equipment(equipment_id,array[''KY_THUAT_VIEN'',''TRUONG_BO_PHAN_KY_THUAT'']::public.eam_role[]))',t);
  execute format('grant delete on public.%I to authenticated',t);
 end loop;
end; $$;
create policy events_read on public.maintenance_events for select to authenticated using(
 exists(select 1 from public.maintenance_plans p where p.id=plan_id));
create policy events_insert on public.maintenance_events for insert to authenticated with check(
 exists(select 1 from public.maintenance_plans p where p.id=plan_id and private.can_equipment(p.equipment_id,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[])));
create policy events_update on public.maintenance_events for update to authenticated using(
 exists(select 1 from public.maintenance_plans p where p.id=plan_id and private.can_equipment(p.equipment_id,array['TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]))) with check(
 exists(select 1 from public.maintenance_plans p where p.id=plan_id and private.can_equipment(p.equipment_id,array['TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[])));
grant insert,update on public.maintenance_events to authenticated;
create policy documents_read on public.technical_documents for select to authenticated using(status<>'archived' and (
 private.can_equipment(equipment_id,array['TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) or
 (kind<>'material_voucher' and private.can_equipment(equipment_id,array['KY_THUAT_VIEN']::public.eam_role[])) or
 (kind='material_voucher' and private.can_equipment(equipment_id,array['CAN_BO_VAT_TU']::public.eam_role[])) or
 (created_by=auth.uid() and kind in ('incident','photo_before','photo_after') and private.can_equipment(equipment_id,array['DOI_SAN_XUAT']::public.eam_role[]))
));
create policy documents_insert on public.technical_documents for insert to authenticated with check(
 created_by=auth.uid() and status='pending' and (
 private.can_equipment(equipment_id,array['TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) or
 (kind<>'material_voucher' and private.can_equipment(equipment_id,array['KY_THUAT_VIEN']::public.eam_role[])) or
 (kind='material_voucher' and private.can_equipment(equipment_id,array['CAN_BO_VAT_TU']::public.eam_role[])) or
 (kind in ('incident','photo_before','photo_after') and private.can_equipment(equipment_id,array['DOI_SAN_XUAT']::public.eam_role[]))));
create policy documents_update on public.technical_documents for update to authenticated using(
 private.document_permission(id,true) or private.can_equipment(equipment_id,array['TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]))
 with check(created_by=auth.uid() or private.can_equipment(equipment_id,array['TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]));
grant insert,update on public.technical_documents to authenticated;
create policy audit_read on public.audit_logs for select to authenticated using(
 private.has_role(workspace_id,array['TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values(
 'eam-documents','eam-documents',false,20971520,
 array['application/pdf','image/jpeg','image/png','image/webp','application/zip','application/octet-stream','text/plain']);
create policy eam_files_read on storage.objects for select to authenticated using(
 bucket_id='eam-documents' and private.storage_permission(name,false));
create policy eam_files_create on storage.objects for insert to authenticated with check(
 bucket_id='eam-documents' and private.storage_permission(name,true));
-- No overwrite or delete: archive metadata, upload a new version instead.

create view public.vw_monthly_metrics with(security_invoker=true) as
with keys as (
 select equipment_id,month from public.monthly_production union select equipment_id,month from public.monthly_operating_hours
)
select e.id as equipment_id,e.workspace_id,e.code as equipment_code,k.month,p.boxes,p.teu,h.operating_hours,e.accumulated_hours
from keys k join public.equipment e on e.id=k.equipment_id
left join public.monthly_production p on p.equipment_id=k.equipment_id and p.month=k.month
left join public.monthly_operating_hours h on h.equipment_id=k.equipment_id and h.month=k.month;
create view public.vw_maintenance_due with(security_invoker=true) as
with due as (
 select p.*, e.workspace_id,e.code as equipment_code,e.accumulated_hours,
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
 else 'normal' end as alert_level
from due;
create view public.vw_inventory_balances with(security_invoker=true) as
select w.workspace_id,w.id as warehouse_id,m.id as material_id,m.code as material_code,m.name,m.unit,
 coalesce(sum(l.quantity_delta),0) as quantity
from public.warehouses w join public.materials m on m.workspace_id=w.workspace_id
left join public.vouchers v on v.warehouse_id=w.id
left join public.voucher_lines l on l.voucher_id=v.id and l.material_id=m.id
where private.has_role(w.workspace_id,array['KY_THUAT_VIEN','CAN_BO_VAT_TU','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[])
group by w.workspace_id,w.id,m.id;
create view public.vw_equipment_history with(security_invoker=true) as
select c.id::text as event_key,c.equipment_id,c.code as case_code,c.kind::text as event_type,
 c.actual_started_at as event_at,c.actual_ended_at,c.summary as title,
 r.code as order_code,
 coalesce((select jsonb_agg(jsonb_build_object('symptom',i.symptom,'root_cause',i.root_cause,
 'solution_plan',i.solution_plan,'execution_result',i.execution_result,
 'execution_status',i.execution_status,'acceptance_status',i.acceptance_status,
 'materials',(select coalesce(jsonb_agg(jsonb_build_object('code',m.code,'name',m.name,'quantity',u.quantity,
 'unit',m.unit,'installed_at',u.installed_at,'document_status',u.document_status)),'[]'::jsonb)
 from public.repair_material_usages u join public.materials m on m.id=u.material_id where u.repair_work_item_id=i.id)
 ) order by i.item_no) from public.repair_work_items i where i.repair_order_id=r.id),'[]'::jsonb) as work_items
from public.work_cases c left join public.repair_orders r on r.case_id=c.id;

-- API functions expose only invoker wrappers; private implementations verify roles.
revoke execute on all functions in schema private from public,anon,authenticated;
grant execute on function private.has_role(uuid,public.eam_role[]),private.can_equipment(uuid,public.eam_role[]),
private.can_order(uuid,public.eam_role[]),private.can_item(uuid,public.eam_role[]),private.case_readable(uuid),
private.document_permission(uuid,boolean),private.storage_permission(text,boolean),
private.create_case(uuid,public.case_kind,timestamptz,timestamptz,text,uuid,uuid),
private.convert_case(uuid),private.import_monthly(uuid,jsonb,uuid) to authenticated;
revoke execute on function public.create_work_case(uuid,public.case_kind,timestamptz,timestamptz,text,uuid),
public.convert_inspection_to_repair(uuid),public.import_monthly_metrics(uuid,jsonb,uuid) from public,anon;
grant execute on function public.create_work_case(uuid,public.case_kind,timestamptz,timestamptz,text,uuid),
public.convert_inspection_to_repair(uuid),public.import_monthly_metrics(uuid,jsonb,uuid) to authenticated;
revoke all on public.vw_monthly_metrics,public.vw_maintenance_due,public.vw_inventory_balances,public.vw_equipment_history from anon;
grant select on public.vw_monthly_metrics,public.vw_maintenance_due,public.vw_inventory_balances,public.vw_equipment_history to authenticated;
commit;
