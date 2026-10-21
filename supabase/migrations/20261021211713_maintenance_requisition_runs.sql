begin;
-- Separate immutable planning snapshots: no warehouse issue or maintenance
-- completion is inferred by creating a requisition.
create table public.maintenance_requisition_runs (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id),
 planned_day date not null,grouping_mode text not null check(grouping_mode in ('equipment','group','date')),
 snapshot jsonb not null,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 fingerprint text not null,unique(workspace_id,created_by,fingerprint)
);
create index maintenance_requisition_runs_workspace_time on public.maintenance_requisition_runs(workspace_id,created_at desc);
create index maintenance_requisition_runs_actor on public.maintenance_requisition_runs(created_by);
create table private.maintenance_requisition_cases (
 equipment_id uuid not null references public.equipment(id),planned_day date not null,
 case_id uuid not null unique references public.work_cases(id),primary key(equipment_id,planned_day)
);
create table private.maintenance_requisition_requests (
 request_key uuid primary key,actor_id uuid not null references auth.users(id),fingerprint text not null,
 run_id uuid not null references public.maintenance_requisition_runs(id)
);
create index maintenance_requisition_requests_actor on private.maintenance_requisition_requests(actor_id);
create index maintenance_requisition_requests_run on private.maintenance_requisition_requests(run_id);
alter table public.maintenance_requisition_runs enable row level security;
alter table private.maintenance_requisition_cases enable row level security;
alter table private.maintenance_requisition_requests enable row level security;
revoke all on public.maintenance_requisition_runs from public,anon,authenticated;
revoke all on private.maintenance_requisition_cases,private.maintenance_requisition_requests from public,anon,authenticated;
grant select on public.maintenance_requisition_runs to authenticated;
create policy maintenance_requisition_read on public.maintenance_requisition_runs for select to authenticated
 using(private.has_role(workspace_id,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT','CAN_BO_VAT_TU']::public.eam_role[]));

create function private.guard_requisition_snapshot() returns trigger language plpgsql set search_path='' as $$
begin raise exception using errcode='42501',message='Kế hoạch đã lưu là bất biến; hãy lưu phiên bản mới'; end; $$;
revoke all on function private.guard_requisition_snapshot() from public,anon,authenticated;
create trigger immutable_snapshot before update or delete on public.maintenance_requisition_runs for each row execute function private.guard_requisition_snapshot();
create trigger audit_row after insert on public.maintenance_requisition_runs for each row execute function private.audit_change();

create function private.save_maintenance_requisition(p_workspace uuid,p_day date,p_grouping text,p_rows jsonb,p_print jsonb,p_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare fp text; prior private.maintenance_requisition_requests; rid uuid; r jsonb; m jsonb; e public.equipment;
 cid uuid; oid uuid; summary_text text; saved_rows jsonb:='[]'; seen uuid[]:='{}'; amount numeric; k text; v jsonb;
begin
 if auth.uid() is null or not private.has_role(p_workspace,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then
  raise exception using errcode='42501',message='Không có quyền lập kế hoạch'; end if;
 if p_key is null or p_day is null or p_day<date '2000-01-01' or p_day>date '2100-12-31'
 or p_grouping is null or p_grouping not in ('equipment','group','date') or p_rows is null or jsonb_typeof(p_rows)<>'array'
 or jsonb_array_length(p_rows) not between 1 and 60 or octet_length(p_rows::text)>400000
 or p_print is null or jsonb_typeof(p_print)<>'object' then
  raise exception using errcode='22023',message='Sai dữ liệu kế hoạch'; end if;
 if (p_print-array['company','department','recipient','warehouse','consumableWarehouse','documentDay'])<>'{}'
 or not p_print ?& array['company','department','recipient','warehouse','consumableWarehouse','documentDay'] then
  raise exception using errcode='22023',message='Sai thông tin in'; end if;
 for k,v in select * from jsonb_each(p_print) loop
  if jsonb_typeof(v)<>'string' or length(v#>>'{}')>200 or (v#>>'{}') ~ '[[:cntrl:]]' then raise exception using errcode='22023',message='Sai thông tin in'; end if;
 end loop;
 if length(btrim(p_print->>'company'))=0 or length(btrim(p_print->>'department'))=0 or length(p_print->>'recipient')>100
 or p_print->>'documentDay' !~ '^\d{4}-\d{2}-\d{2}$' or (p_print->>'documentDay')::date not between date '2000-01-01' and date '2100-12-31' then
  raise exception using errcode='22023',message='Thiếu thông tin in'; end if;
 fp:=encode(sha256(convert_to(jsonb_build_array(p_workspace,p_day,p_grouping,p_rows,p_print)::text,'UTF8')),'hex');
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
   amount:=(m->>'quantity')::numeric;
   if amount<=0 or amount>100000 or amount<>round(amount,3) then raise exception using errcode='22023',message='Sai số lượng'; end if;
  end loop;
  select case_id into cid from private.maintenance_requisition_cases where equipment_id=e.id and planned_day=p_day;
  if cid is null then
   summary_text:='Kế hoạch bảo dưỡng '||p_day::text||' · '||(r->>'maintenanceLevel');
   cid:=private.create_case(e.id,'maintenance',clock_timestamp(),null,summary_text,gen_random_uuid());
   update public.work_cases set tracking_only=true where id=cid;
   insert into public.repair_orders(equipment_id,code,title,case_id) values(e.id,'AUTO',summary_text,cid) returning id into oid;
   insert into public.repair_work_items(repair_order_id,item_no,symptom,solution_plan) values(oid,1,summary_text,'Theo kế hoạch đã lưu; chưa xác nhận thực hiện');
   insert into public.case_material_followups(case_id) values(cid);
   insert into private.maintenance_requisition_cases values(e.id,p_day,cid);
  end if;
  saved_rows:=saved_rows||jsonb_build_array(r||jsonb_build_object('equipmentName',e.name,'caseId',cid,'caseCode',(select code from public.work_cases where id=cid)));
 end loop;
 if exists(select 1 from jsonb_array_elements(saved_rows) as x(row_data) cross join lateral jsonb_array_elements(x.row_data->'materials') as y(material)
  group by y.material->>'key',y.material->>'unit',coalesce(y.material->>'catalogueCode',''),y.material->>'source'
  having count(distinct y.material->>'name')>1 or sum((y.material->>'quantity')::numeric)>10000000) then
  raise exception using errcode='22023',message='Danh điểm hoặc tổng số lượng không nhất quán'; end if;
 insert into public.maintenance_requisition_runs(workspace_id,planned_day,grouping_mode,snapshot,created_by,fingerprint)
 values(p_workspace,p_day,p_grouping,jsonb_build_object('version',1,'rows',saved_rows,'print',p_print),auth.uid(),fp) returning id into rid;
 insert into private.maintenance_requisition_requests values(p_key,auth.uid(),fp,rid);
 return rid;
end; $$;
create function public.save_maintenance_requisition(p_workspace uuid,p_day date,p_grouping text,p_rows jsonb,p_print jsonb,p_key uuid)
returns uuid language sql security invoker set search_path='' as $$select private.save_maintenance_requisition(p_workspace,p_day,p_grouping,p_rows,p_print,p_key)$$;
revoke all on function private.save_maintenance_requisition(uuid,date,text,jsonb,jsonb,uuid),public.save_maintenance_requisition(uuid,date,text,jsonb,jsonb,uuid) from public,anon;
grant execute on function private.save_maintenance_requisition(uuid,date,text,jsonb,jsonb,uuid),public.save_maintenance_requisition(uuid,date,text,jsonb,jsonb,uuid) to authenticated;
commit;
