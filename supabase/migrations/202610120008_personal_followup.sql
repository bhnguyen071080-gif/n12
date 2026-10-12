-- Additive upgrade. Do not re-run foundation or fixtures on live data.
begin;
alter table public.work_cases add column tracking_only boolean not null default false;
alter table public.repair_work_items add column performed_on date check(performed_on>=date '2000-01-01');
alter table public.repair_work_items add column version_no integer not null default 1 check(version_no>0);
alter table public.repair_material_usages add column supply_state text not null default 'planned' check(supply_state in ('planned','borrowed','issued'));
alter table public.repair_material_usages add column is_installed boolean not null default false;
alter table public.repair_material_usages add column installation_position text not null default '';
alter table public.materials add column service_limit_hours numeric(18,2) check(service_limit_hours>0);
alter table public.materials add column service_warning_hours numeric(18,2) not null default 25 check(service_warning_hours>=0);
create table public.case_material_followups(
 case_id uuid primary key references public.work_cases(id),return_status text not null default 'pending' check(return_status in ('pending','completed')),
 completed_at timestamptz,notes text not null default '',version_no integer not null default 1 check(version_no>0),
 check((return_status='completed')=(completed_at is not null))
);
alter table public.case_material_followups enable row level security;
revoke all on public.case_material_followups from public,anon,authenticated;
grant select on public.case_material_followups to authenticated;
create policy followup_read on public.case_material_followups for select to authenticated using(exists(
 select 1 from public.work_cases c where c.id=case_id and c.tracking_only and
 private.can_equipment(c.equipment_id,array['KY_THUAT_VIEN','CAN_BO_VAT_TU','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[])));
create trigger audit_row after insert or update or delete on public.case_material_followups for each row execute function private.audit_change();
create table private.followup_requests(request_key uuid primary key,actor_id uuid not null references auth.users(id),fingerprint text not null,result_id uuid not null);
revoke all on private.followup_requests from public,anon,authenticated;
alter table private.followup_requests enable row level security;
create or replace function private.create_case(p_equipment uuid,p_kind public.case_kind,p_started timestamptz,
 p_ended timestamptz,p_summary text,p_key uuid,p_parent uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare e public.equipment; existing public.work_cases; cid uuid:=gen_random_uuid();
 d date; n bigint; prefix text; fp text; oid uuid; entered timestamptz:=clock_timestamp();
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
 d:=(entered at time zone 'Asia/Bangkok')::date;
 insert into private.case_counters values(p_equipment,p_kind,d,1)
 on conflict(equipment_id,kind,actual_day) do update set last_value=private.case_counters.last_value+1
 returning last_value into n;
 prefix:=case p_kind when 'repair' then 'SC' when 'maintenance' then 'BD' when 'cleaning' then 'VS' else 'KT' end;
 insert into public.work_cases(id,equipment_id,kind,code,actual_started_at,actual_ended_at,summary,created_by,request_key,request_fingerprint,parent_case_id,created_at)
 values(cid,p_equipment,p_kind,prefix||'-'||e.code||'-'||to_char(entered at time zone 'Asia/Bangkok','DDMMYYYY-HH24MI')||'-'||lpad(n::text,greatest(4,length(n::text)),'0'),
 p_started,p_ended,btrim(p_summary),auth.uid(),p_key,fp,p_parent,entered);
 if p_kind='repair' then
  insert into public.repair_orders(equipment_id,code,title,case_id) values(p_equipment,'AUTO',p_summary,cid) returning id into oid;
  insert into public.repair_work_items(repair_order_id,item_no,symptom) values(oid,1,p_summary);
 end if;
 return cid;
end; $$;
create or replace function private.guard_order_case()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and new.case_id is distinct from old.case_id then
  raise exception using errcode='42501',message='Không được đổi mã vụ việc nguồn';
 end if;
 if new.case_id is not null and not exists(select 1 from public.work_cases c
 where c.id=new.case_id and (c.kind='repair' or c.tracking_only) and c.equipment_id=new.equipment_id) then
  raise exception using errcode='22023',message='Vụ việc sửa chữa không cùng phương tiện';
 end if;
 return new;
end; $$;
create or replace function private.guard_case()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.id<>old.id or new.equipment_id<>old.equipment_id or new.kind<>old.kind or new.code<>old.code
 or new.created_by<>old.created_by or new.request_key<>old.request_key or new.parent_case_id is distinct from old.parent_case_id
 or new.request_fingerprint<>old.request_fingerprint or new.created_at<>old.created_at or (new.tracking_only<>old.tracking_only and current_user<>'postgres') then
  raise exception using errcode='42501',message='Mã và liên kết vụ việc là bất biến';
 end if;
 if old.submitted_at is not null and current_user<>'postgres' then
  raise exception using errcode='22023',message='Phiếu đã gửi, không được sửa trực tiếp';
 end if;
 if new.submitted_at is not null and old.submitted_at is null then new.submitted_at:=now(); end if;
 return new;
end; $$;
create or replace function private.guard_work_item()
returns trigger language plpgsql set search_path='' as $$
declare tech boolean; supply boolean; head boolean; r public.repair_orders;
begin
 select * into strict r from public.repair_orders where id=new.repair_order_id;
 head:=private.can_order(r.id,array['TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]);
 tech:=private.can_order(r.id,array['KY_THUAT_VIEN']::public.eam_role[]);
 supply:=private.can_order(r.id,array['CAN_BO_VAT_TU']::public.eam_role[]);
 if r.closed_at is not null or r.cancelled_at is not null then
  raise exception using errcode='22023',message='Hồ sơ đã đóng/hủy, không được sửa hạng mục';
 end if;
 if tg_op='UPDATE' then
  if new.id<>old.id or new.repair_order_id<>old.repair_order_id or new.item_no<>old.item_no then
   raise exception using errcode='42501',message='Không được chuyển hạng mục sang hồ sơ khác';
  end if;
  if not head then
   if old.acceptance_status='accepted' and row(new.symptom,new.root_cause,new.solution_plan,new.execution_result,new.execution_status)
    is distinct from row(old.symptom,old.root_cause,old.solution_plan,old.execution_result,old.execution_status) then
    raise exception using errcode='22023',message='Phải mở lại nghiệm thu trước khi sửa nội dung đã nghiệm thu';
   end if;
   if not tech and row(new.symptom,new.root_cause,new.solution_plan,new.execution_result,new.basis_status,new.execution_status)
       is distinct from row(old.symptom,old.root_cause,old.solution_plan,old.execution_result,old.basis_status,old.execution_status) then
    raise exception using errcode='42501',message='Không có quyền sửa nội dung kỹ thuật';
   end if;
   if not supply and row(new.material_status,new.requisition_status) is distinct from row(old.material_status,old.requisition_status) then
    raise exception using errcode='42501',message='Không có quyền xác nhận tiến độ vật tư/phiếu';
   end if;
   if new.acceptance_status is distinct from old.acceptance_status or
      (new.dossier_status is distinct from old.dossier_status and (not tech or new.dossier_status='closed')) then
    raise exception using errcode='42501',message='Không có quyền nghiệm thu/đóng chứng từ';
   end if;
  end if;
 else
  if current_user<>'postgres' and not head and (
    new.acceptance_status<>'pending' or new.dossier_status='closed' or
    new.material_status<>'procurement_pending' or new.requisition_status<>'not_applicable'
  ) then raise exception using errcode='42501',message='Không được cấp trạng thái vượt quyền lúc tạo'; end if;
 end if;
 if new.execution_status='completed' then
  if least(length(btrim(new.symptom)),length(btrim(new.root_cause)),length(btrim(new.solution_plan)),length(btrim(new.execution_result)))=0 then
   raise exception using errcode='22023',message='Hoàn thành phải có đủ bốn nội dung kỹ thuật';
  end if;
  new.completed_at:=coalesce(case when tg_op='UPDATE' then old.completed_at end,now());
 else new.completed_at:=null; end if;
 if new.acceptance_status='accepted' and new.execution_status<>'completed' then
  raise exception using errcode='22023',message='Chưa hoàn thành không được nghiệm thu';
 end if;
 if new.dossier_status='closed' and (new.acceptance_status<>'accepted' or
 case when exists(select 1 from public.work_cases c where c.id=r.case_id and c.tracking_only) then
  exists(select 1 from public.repair_material_usages u where u.repair_work_item_id=new.id) and
  not exists(select 1 from public.case_material_followups f where f.case_id=r.case_id and f.return_status='completed')
 else exists(select 1 from public.repair_material_usages u where u.repair_work_item_id=new.id
 and (u.document_status<>'documents_complete' or u.returned_quantity<u.borrowed_quantity)) end) then raise exception using errcode='22023',message='Chưa nghiệm thu hoặc còn nợ vật tư/chứng từ'; end if;
 return new;
end; $$;
create or replace function private.guard_material_usage()
returns trigger language plpgsql security definer set search_path='' as $$
declare item public.repair_work_items; r public.repair_orders; w uuid;
begin
 select * into strict item from public.repair_work_items where id=new.repair_work_item_id;
 select * into strict r from public.repair_orders where id=item.repair_order_id for update;
 select workspace_id into strict w from public.equipment where id=r.equipment_id;
 if exists(select 1 from public.work_cases c where c.id=r.case_id and c.tracking_only) then
  if not private.can_item(item.id,array['KY_THUAT_VIEN','CAN_BO_VAT_TU','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then
   raise exception using errcode='42501',message='Không có quyền theo dõi vật tư'; end if;
  if not exists(select 1 from public.materials where id=new.material_id and workspace_id=w) then
   raise exception using errcode='22023',message='Vật tư khác workspace'; end if;
  if r.closed_at is not null or r.cancelled_at is not null or item.dossier_status='closed' then
   raise exception using errcode='22023',message='Hồ sơ/hạng mục đã đóng'; end if;
  if tg_op='UPDATE' and row(new.id,new.material_id,new.repair_work_item_id) is distinct from row(old.id,old.material_id,old.repair_work_item_id) then
   raise exception using errcode='42501',message='Không được đổi liên kết vật tư'; end if;
  if tg_op='UPDATE' and new.quantity<>old.quantity and exists(select 1 from public.case_material_followups where case_id=r.case_id and return_status='completed') then
   raise exception using errcode='22023',message='Mở lại trả phiếu trước khi sửa số lượng'; end if;
  if new.is_installed and item.performed_on is null then raise exception using errcode='22023',message='Thiếu ngày thực hiện hạng mục'; end if;
  if (tg_op='INSERT' and (new.document_status<>'urgent_borrow' or new.borrowed_quantity<>0 or new.returned_quantity<>0))
   or (tg_op='UPDATE' and row(new.document_status,new.borrowed_quantity,new.returned_quantity) is distinct from row(old.document_status,old.borrowed_quantity,old.returned_quantity)) then
   raise exception using errcode='22023',message='Vụ theo dõi không ghi sổ kho'; end if;
  new.installed_at:=case when new.is_installed then item.performed_on::timestamp at time zone 'Asia/Bangkok' end;
  return new;
 end if;
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

create function private.tracking_item_stamp() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if new.version_no<>old.version_no then raise exception using errcode='40001',message='Sai phiên bản hạng mục'; end if;
  new.version_no:=old.version_no+1;
  if new.performed_on is distinct from old.performed_on and
   (not private.can_order(new.repair_order_id,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) or
   (old.acceptance_status='accepted' and not private.can_order(new.repair_order_id,array['TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]))) then
   raise exception using errcode='42501',message='Không có quyền sửa ngày thực hiện'; end if;
 else new.version_no:=1; end if;
 if new.execution_status='completed' and exists(select 1 from public.repair_orders r join public.work_cases c on c.id=r.case_id where r.id=new.repair_order_id and c.tracking_only) then
  if new.performed_on is null then raise exception using errcode='22023',message='Hoàn thành cần ngày thực hiện'; end if;
  new.completed_at:=new.performed_on::timestamp at time zone 'Asia/Bangkok';
 end if;
 return new;
end; $$;
create trigger z_tracking_item_stamp before insert or update on public.repair_work_items for each row execute function private.tracking_item_stamp();
create function private.tracking_item_sync() returns trigger language plpgsql security definer set search_path='' as $$
declare cid uuid; finish timestamptz;
begin
 select r.case_id into cid from public.repair_orders r join public.work_cases c on c.id=r.case_id where r.id=new.repair_order_id and c.tracking_only;
 if cid is not null then
  if tg_op='UPDATE' and new.performed_on is distinct from old.performed_on then
   update public.repair_material_usages set installed_at=new.performed_on::timestamp at time zone 'Asia/Bangkok' where repair_work_item_id=new.id and is_installed;
  end if;
  if not exists(select 1 from public.repair_work_items where repair_order_id=new.repair_order_id and execution_status<>'completed') then
   select greatest(c.actual_started_at,max(i.performed_on)::timestamp at time zone 'Asia/Bangkok') into finish
   from public.work_cases c cross join public.repair_work_items i where c.id=cid and i.repair_order_id=new.repair_order_id group by c.actual_started_at;
  end if;
  update public.work_cases set actual_ended_at=finish where id=cid and actual_ended_at is distinct from finish;
 end if;
 return new;
end; $$;
create trigger tracking_item_sync after insert or update on public.repair_work_items for each row execute function private.tracking_item_sync();
create function private.reopen_followup() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.case_material_followups set return_status='pending',completed_at=null,version_no=version_no+1
 where case_id=(select r.case_id from public.repair_work_items i join public.repair_orders r on r.id=i.repair_order_id where i.id=new.repair_work_item_id);
 return new;
end; $$;
create trigger reopen_followup after insert on public.repair_material_usages for each row execute function private.reopen_followup();
create policy tracking_cases_read on public.work_cases for select to authenticated using(tracking_only and private.can_equipment(equipment_id,array['CAN_BO_VAT_TU']::public.eam_role[]));
create policy tracking_usage_create on public.repair_material_usages for insert to authenticated with check(
 private.can_item(repair_work_item_id,array['KY_THUAT_VIEN']::public.eam_role[]) and exists(
 select 1 from public.repair_work_items i join public.repair_orders r on r.id=i.repair_order_id join public.work_cases c on c.id=r.case_id where i.id=repair_work_item_id and c.tracking_only));
create policy tracking_usage_update on public.repair_material_usages for update to authenticated using(
 private.can_item(repair_work_item_id,array['KY_THUAT_VIEN']::public.eam_role[]) and exists(
 select 1 from public.repair_work_items i join public.repair_orders r on r.id=i.repair_order_id join public.work_cases c on c.id=r.case_id where i.id=repair_work_item_id and c.tracking_only))
 with check(private.can_item(repair_work_item_id,array['KY_THUAT_VIEN']::public.eam_role[]));

create function private.create_tracking_case(p_equipment uuid,p_kind public.case_kind,p_day date,p_summary text,p_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid; oid uuid; prior public.work_cases;
begin
 if not private.can_equipment(p_equipment,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then raise exception using errcode='42501',message='Không có quyền tạo vụ theo dõi'; end if;
 if p_day is null or p_day<date '2000-01-01' then raise exception using errcode='22023',message='Ngày không hợp lệ'; end if;
 perform 1 from public.equipment where id=p_equipment for update;
 select * into prior from public.work_cases where request_key=p_key;
 if found and not prior.tracking_only then raise exception using errcode='22023',message='Khóa đã thuộc luồng khác'; end if;
 cid:=private.create_case(p_equipment,p_kind,p_day::timestamp at time zone 'Asia/Bangkok',null,p_summary,p_key);
 if prior.id is not null then return cid; end if;
 update public.work_cases set tracking_only=true where id=cid;
 select id into oid from public.repair_orders where case_id=cid;
 if oid is null then
  insert into public.repair_orders(equipment_id,code,title,case_id) values(p_equipment,'AUTO',p_summary,cid) returning id into oid;
  insert into public.repair_work_items(repair_order_id,item_no,symptom,performed_on) values(oid,1,p_summary,p_day);
 else update public.repair_work_items set performed_on=p_day where repair_order_id=oid; end if;
 insert into public.case_material_followups(case_id) values(cid);
 return cid;
end; $$;
create function public.create_tracking_case(p_equipment uuid,p_kind public.case_kind,p_day date,p_summary text,p_key uuid)
returns uuid language sql security invoker set search_path='' as $$select private.create_tracking_case(p_equipment,p_kind,p_day,p_summary,p_key)$$;

create function private.save_tracking_item(p_order uuid,p_item uuid,p_version integer,p_data jsonb,p_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare i public.repair_work_items; prior private.followup_requests; fp text; n integer;
begin
 if not private.can_order(p_order,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then raise exception using errcode='42501',message='Không có quyền sửa hạng mục'; end if;
 perform 1 from public.repair_orders where id=p_order for update;
 if not exists(select 1 from public.repair_orders r join public.work_cases c on c.id=r.case_id where r.id=p_order and c.tracking_only) then raise exception using errcode='22023',message='Không phải vụ theo dõi'; end if;
 if p_key is null or p_data is null or jsonb_typeof(p_data)<>'object' or (p_data-array['symptom','root_cause','solution_plan','execution_result','performed_on','basis_status','material_status','requisition_status','execution_status','acceptance_status','dossier_status'])<>'{}'::jsonb then raise exception using errcode='22023',message='Sai dữ liệu hạng mục'; end if;
 fp:=md5(jsonb_build_array('item',p_order,p_item,p_version,p_data)::text);
 select * into prior from private.followup_requests where request_key=p_key;
 if found then
  if prior.actor_id<>auth.uid() or prior.fingerprint<>fp then raise exception using errcode='22023',message='Khóa đã sử dụng'; end if;
  return prior.result_id;
 end if;
 if p_item is null then
  select coalesce(max(item_no),0)+1 into n from public.repair_work_items where repair_order_id=p_order;
  insert into public.repair_work_items(repair_order_id,item_no) values(p_order,n) returning * into i;
 else
  select * into strict i from public.repair_work_items where id=p_item and repair_order_id=p_order;
  if p_version is null or p_version<>i.version_no then raise exception using errcode='40001',message='Hạng mục đã thay đổi'; end if;
 end if;
 update public.repair_work_items set symptom=coalesce(p_data->>'symptom',i.symptom),root_cause=coalesce(p_data->>'root_cause',i.root_cause),
 solution_plan=coalesce(p_data->>'solution_plan',i.solution_plan),execution_result=coalesce(p_data->>'execution_result',i.execution_result),
 performed_on=case when p_data ? 'performed_on' then (p_data->>'performed_on')::date else i.performed_on end,
 basis_status=coalesce(p_data->>'basis_status',i.basis_status::text)::public.basis_progress,
 material_status=coalesce(p_data->>'material_status',i.material_status::text)::public.material_progress,
 requisition_status=coalesce(p_data->>'requisition_status',i.requisition_status::text)::public.requisition_progress,
 execution_status=coalesce(p_data->>'execution_status',i.execution_status::text)::public.execution_progress,
 acceptance_status=coalesce(p_data->>'acceptance_status',i.acceptance_status::text)::public.acceptance_progress,
 dossier_status=coalesce(p_data->>'dossier_status',i.dossier_status::text)::public.dossier_progress where id=i.id;
 insert into private.followup_requests values(p_key,auth.uid(),fp,i.id);
 return i.id;
end; $$;
create function public.save_tracking_item(p_order uuid,p_item uuid,p_version integer,p_data jsonb,p_key uuid)
returns uuid language sql security invoker set search_path='' as $$select private.save_tracking_item(p_order,p_item,p_version,p_data,p_key)$$;

create function private.add_tracking_material(p_item uuid,p_material uuid,p_quantity numeric,p_supply text,p_installed boolean,p_position text,p_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid; result uuid; prior private.followup_requests; fp text;
begin
 if not private.can_item(p_item,array['KY_THUAT_VIEN','CAN_BO_VAT_TU','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then raise exception using errcode='42501',message='Không có quyền theo dõi vật tư'; end if;
 select repair_order_id into strict rid from public.repair_work_items where id=p_item;
 perform 1 from public.repair_orders where id=rid for update;
 if not exists(select 1 from public.repair_orders r join public.work_cases c on c.id=r.case_id where r.id=rid and c.tracking_only) then raise exception using errcode='22023',message='Không phải vụ theo dõi'; end if;
 if p_key is null or p_quantity is null or p_quantity<=0 or p_quantity<>round(p_quantity,3) or p_supply is null or p_supply not in ('planned','borrowed','issued') or p_installed is null then raise exception using errcode='22023',message='Sai dòng vật tư'; end if;
 fp:=md5(jsonb_build_array('material',p_item,p_material,p_quantity,p_supply,p_installed,p_position)::text);
 select * into prior from private.followup_requests where request_key=p_key;
 if found then
  if prior.actor_id<>auth.uid() or prior.fingerprint<>fp then raise exception using errcode='22023',message='Khóa đã sử dụng'; end if;
  return prior.result_id;
 end if;
 insert into public.repair_material_usages(repair_work_item_id,material_id,quantity,supply_state,is_installed,installation_position)
 values(p_item,p_material,p_quantity,p_supply,p_installed,coalesce(p_position,'')) returning id into result;
 insert into private.followup_requests values(p_key,auth.uid(),fp,result);
 return result;
end; $$;
create function public.add_tracking_material(p_item uuid,p_material uuid,p_quantity numeric,p_supply text,p_installed boolean,p_position text,p_key uuid)
returns uuid language sql security invoker set search_path='' as $$select private.add_tracking_material(p_item,p_material,p_quantity,p_supply,p_installed,p_position,p_key)$$;

create function private.update_tracking_material(p_usage uuid,p_supply text,p_installed boolean)
returns void language plpgsql security definer set search_path='' as $$
declare u public.repair_material_usages;
begin
 select * into strict u from public.repair_material_usages where id=p_usage;
 if not private.can_item(u.repair_work_item_id,array['KY_THUAT_VIEN','CAN_BO_VAT_TU','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then raise exception using errcode='42501',message='Không có quyền theo dõi vật tư'; end if;
 if not exists(select 1 from public.repair_work_items i join public.repair_orders r on r.id=i.repair_order_id join public.work_cases c on c.id=r.case_id where i.id=u.repair_work_item_id and c.tracking_only) or p_supply is null or p_supply not in ('planned','borrowed','issued') or p_installed is null then raise exception using errcode='22023',message='Không phải dòng theo dõi hoặc sai trạng thái'; end if;
 update public.repair_material_usages set supply_state=p_supply,is_installed=p_installed where id=p_usage;
end; $$;
create function public.update_tracking_material(p_usage uuid,p_supply text,p_installed boolean)
returns void language sql security invoker set search_path='' as $$select private.update_tracking_material(p_usage,p_supply,p_installed)$$;

create function private.set_material_return(p_case uuid,p_status text,p_completed timestamptz,p_version integer,p_notes text)
returns void language plpgsql security definer set search_path='' as $$
declare c public.work_cases; f public.case_material_followups; rid uuid;
begin
 select * into strict c from public.work_cases where id=p_case;
 if not c.tracking_only or not private.can_equipment(c.equipment_id,array['KY_THUAT_VIEN','CAN_BO_VAT_TU','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then raise exception using errcode='42501',message='Không có quyền trả phiếu'; end if;
 select id into strict rid from public.repair_orders where case_id=p_case;
 perform 1 from public.repair_orders where id=rid for update;
 select * into strict f from public.case_material_followups where case_id=p_case;
 if p_version is null or f.version_no<>p_version then
  if f.version_no=p_version+1 and f.return_status=p_status and f.notes=coalesce(p_notes,'') and f.completed_at is not distinct from (case when p_status='completed' then p_completed end) then return; end if;
  raise exception using errcode='40001',message='Vật tư/trả phiếu đã thay đổi'; end if;
 if p_status is null or p_status not in ('pending','completed') or (p_status='completed' and (p_completed is null or not exists(
 select 1 from public.repair_material_usages u join public.repair_work_items i on i.id=u.repair_work_item_id where i.repair_order_id=rid))) then raise exception using errcode='22023',message='Thiếu vật tư hoặc thời gian hoàn tất'; end if;
 update public.case_material_followups set return_status=p_status,completed_at=case when p_status='completed' then p_completed end,notes=coalesce(p_notes,''),version_no=version_no+1 where case_id=p_case;
end; $$;
create function public.set_material_return(p_case uuid,p_status text,p_completed timestamptz,p_version integer,p_notes text)
returns void language sql security invoker set search_path='' as $$select private.set_material_return(p_case,p_status,p_completed,p_version,p_notes)$$;
create view public.vw_case_followup_backlog with(security_invoker=true) as
select e.workspace_id,e.code equipment_code,c.id case_id,c.code case_code,c.summary,f.return_status,f.completed_at,f.version_no,count(u.id) material_lines
from public.case_material_followups f join public.work_cases c on c.id=f.case_id join public.equipment e on e.id=c.equipment_id
join public.repair_orders r on r.case_id=c.id join public.repair_work_items i on i.repair_order_id=r.id join public.repair_material_usages u on u.repair_work_item_id=i.id
where c.tracking_only and r.cancelled_at is null and f.return_status='pending' group by e.workspace_id,e.code,c.id,f.case_id;
revoke all on public.vw_case_followup_backlog from public,anon;
grant select on public.vw_case_followup_backlog to authenticated;
revoke execute on function private.create_tracking_case(uuid,public.case_kind,date,text,uuid),public.create_tracking_case(uuid,public.case_kind,date,text,uuid) from public,anon;
grant execute on function private.create_tracking_case(uuid,public.case_kind,date,text,uuid),public.create_tracking_case(uuid,public.case_kind,date,text,uuid) to authenticated;
revoke execute on function private.save_tracking_item(uuid,uuid,integer,jsonb,uuid),public.save_tracking_item(uuid,uuid,integer,jsonb,uuid) from public,anon;
grant execute on function private.save_tracking_item(uuid,uuid,integer,jsonb,uuid),public.save_tracking_item(uuid,uuid,integer,jsonb,uuid) to authenticated;
revoke execute on function private.add_tracking_material(uuid,uuid,numeric,text,boolean,text,uuid),public.add_tracking_material(uuid,uuid,numeric,text,boolean,text,uuid) from public,anon;
grant execute on function private.add_tracking_material(uuid,uuid,numeric,text,boolean,text,uuid),public.add_tracking_material(uuid,uuid,numeric,text,boolean,text,uuid) to authenticated;
revoke execute on function private.update_tracking_material(uuid,text,boolean),public.update_tracking_material(uuid,text,boolean) from public,anon;
grant execute on function private.update_tracking_material(uuid,text,boolean),public.update_tracking_material(uuid,text,boolean) to authenticated;
revoke execute on function private.set_material_return(uuid,text,timestamptz,integer,text),public.set_material_return(uuid,text,timestamptz,integer,text) from public,anon;
grant execute on function private.set_material_return(uuid,text,timestamptz,integer,text),public.set_material_return(uuid,text,timestamptz,integer,text) to authenticated;
create or replace view public.vw_equipment_history with(security_invoker=true) as
with base as (
 select c.id::text as event_key,c.equipment_id,c.code as case_code,c.kind::text as event_type,
 c.actual_started_at as event_at,c.actual_ended_at,c.summary as title,r.id as order_id,r.code as order_code
 from public.work_cases c left join public.repair_orders r on r.case_id=c.id
 union all
 select 'repair:'||r.id,r.equipment_id,null,'repair',r.opened_at,r.closed_at,r.title,r.id,r.code
 from public.repair_orders r where r.case_id is null
)
select b.*,
 coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'performed_on',i.performed_on,'symptom',i.symptom,'root_cause',i.root_cause,
 'solution_plan',i.solution_plan,'execution_result',i.execution_result,
 'basis_status',i.basis_status,'material_status',i.material_status,'requisition_status',i.requisition_status,
 'execution_status',i.execution_status,'acceptance_status',i.acceptance_status,'dossier_status',i.dossier_status,
 'materials',(select coalesce(jsonb_agg(jsonb_build_object('code',m.code,'name',m.name,'quantity',u.quantity,
 'unit',m.unit,'installed_at',u.installed_at,'document_status',u.document_status,'position',u.installation_position,'supply_state',u.supply_state,
 'return_status',(select f.return_status from public.case_material_followups f where f.case_id=(select r.case_id from public.repair_orders r where r.id=b.order_id)),
 'return_completed_at',(select f.completed_at from public.case_material_followups f where f.case_id=(select r.case_id from public.repair_orders r where r.id=b.order_id)))),'[]'::jsonb)
 from public.repair_material_usages u join public.materials m on m.id=u.material_id where u.repair_work_item_id=i.id)
 ) order by i.item_no) from public.repair_work_items i where i.repair_order_id=b.order_id),'[]'::jsonb) as work_items,
 coalesce((select sum(extract(epoch from upper(s.r)-lower(s.r))/3600)
 from (select unnest(range_agg(tstzrange(d.started_at,coalesce(d.ended_at,now()),'[)'))) as r
 from public.equipment_downtimes d where d.repair_order_id=b.order_id) s),0) as downtime_hours
from base b;

create or replace function private.quick_fault(p_equipment uuid,p_when timestamptz,p_symptom text,p_stopped boolean,p_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid; oid uuid; iid uuid; previous boolean;
begin
 if p_stopped is null then raise exception using errcode='22023',message='Phải chọn tình trạng dừng máy'; end if;
 previous:=exists(select 1 from public.work_cases where request_key=p_key);
 -- Include stop flag in the case fingerprint to reject inconsistent retries.
 cid:=private.create_case(p_equipment,'repair',p_when,null,p_symptom,p_key);
 select id into strict oid from public.repair_orders where case_id=cid;
 if not previous then
  update public.work_cases set tracking_only=true where id=cid;
  update public.repair_work_items set performed_on=(p_when at time zone 'Asia/Bangkok')::date where repair_order_id=oid;
  insert into public.case_material_followups(case_id) values(cid);
 end if;
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
create or replace function private.convert_case(p_case uuid)
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
 update public.work_cases set tracking_only=true where id=child;
 update public.repair_work_items set performed_on=(c.actual_started_at at time zone 'Asia/Bangkok')::date where repair_order_id=oid;
 insert into public.case_material_followups(case_id) values(child);
 return oid;
end; $$;
create or replace view public.vw_procedural_backlog with(security_invoker=true) as
select e.workspace_id,e.id as equipment_id,e.code as equipment_code,e.status as equipment_status,
 r.code as order_code,i.id as item_id,i.symptom,i.material_status,i.requisition_status,i.dossier_status,
 coalesce((select sum(u.borrowed_quantity-u.returned_quantity) from public.repair_material_usages u where u.repair_work_item_id=i.id),0) as borrowed_quantity_outstanding,
 (select count(*) from public.repair_material_usages u where u.repair_work_item_id=i.id and u.document_status<>'documents_complete') as unsettled_material_lines
from public.equipment e join public.repair_orders r on r.equipment_id=e.id join public.repair_work_items i on i.repair_order_id=r.id
where not exists(select 1 from public.work_cases c where c.id=r.case_id and c.tracking_only) and r.closed_at is null and r.cancelled_at is null and e.status='available' and i.execution_status='completed'
 and (i.material_status='borrowed' or i.requisition_status='temporary_issue_debt' or i.dossier_status<>'closed'
 or exists(select 1 from public.repair_material_usages u where u.repair_work_item_id=i.id and (u.returned_quantity<u.borrowed_quantity or u.document_status<>'documents_complete')))
 and private.can_equipment(e.id,array['KY_THUAT_VIEN','CAN_BO_VAT_TU','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[])
union all
select e.workspace_id,e.id,e.code,e.status,r.code,i.id,i.symptom,i.material_status,i.requisition_status,i.dossier_status,0::numeric,
 (select count(*) from public.repair_material_usages u where u.repair_work_item_id=i.id and f.return_status<>'completed')
from public.equipment e join public.repair_orders r on r.equipment_id=e.id join public.repair_work_items i on i.repair_order_id=r.id
join public.work_cases c on c.id=r.case_id and c.tracking_only join public.case_material_followups f on f.case_id=c.id
where r.closed_at is null and r.cancelled_at is null and e.status='available' and i.execution_status='completed'
and (i.dossier_status<>'closed' or (f.return_status<>'completed' and exists(select 1 from public.repair_material_usages u where u.repair_work_item_id=i.id)))
and private.can_equipment(e.id,array['KY_THUAT_VIEN','CAN_BO_VAT_TU','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]);
commit;
