-- Confirm a checked monthly maintenance plan once and keep the exact print snapshot.
begin;
create table if not exists public.maintenance_requisition_runs(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id),planned_day date not null,
 grouping_mode text not null check(grouping_mode in ('equipment','group','date')),snapshot jsonb not null,created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),fingerprint text not null,unique(workspace_id,created_by,fingerprint)
);
alter table public.maintenance_requisition_runs enable row level security;
revoke all on public.maintenance_requisition_runs from public,anon,authenticated;
grant select on public.maintenance_requisition_runs to authenticated;
drop policy if exists maintenance_requisition_runs_read on public.maintenance_requisition_runs;
create policy maintenance_requisition_runs_read on public.maintenance_requisition_runs for select to authenticated using(
 private.has_role(workspace_id,array['KY_THUAT_VIEN','CAN_BO_VAT_TU','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]));

create table if not exists private.maintenance_requisition_cases(
 equipment_id uuid not null references public.equipment(id),planned_day date not null,case_id uuid not null unique references public.work_cases(id),primary key(equipment_id,planned_day));
create table if not exists private.maintenance_requisition_requests(
 request_key uuid primary key,actor_id uuid not null references auth.users(id),fingerprint text not null,run_id uuid not null references public.maintenance_requisition_runs(id));
revoke all on private.maintenance_requisition_cases,private.maintenance_requisition_requests from public,anon,authenticated;
alter table private.maintenance_requisition_cases enable row level security;
alter table private.maintenance_requisition_requests enable row level security;

create or replace function private.save_maintenance_requisition(p_workspace uuid,p_day date,p_grouping text,p_rows jsonb,p_print jsonb,p_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare fp text; prior private.maintenance_requisition_requests; rid uuid; r jsonb; e public.equipment; cid uuid; oid uuid; saved jsonb:='[]'; seen uuid[]:='{}'; summary_text text;
begin
 if auth.uid() is null or not private.has_role(p_workspace,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then raise exception using errcode='42501',message='Không có quyền lập kế hoạch';end if;
 if p_key is null or p_day is null or p_grouping not in ('equipment','group','date') or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 60 or jsonb_typeof(p_print)<>'object' then raise exception using errcode='22023',message='Sai dữ liệu kế hoạch';end if;
 fp:=encode(sha256(convert_to(jsonb_build_array(p_workspace,p_day,p_grouping,p_rows,p_print)::text,'UTF8')),'hex');
 perform 1 from public.workspaces where id=p_workspace for update;
 select * into prior from private.maintenance_requisition_requests where request_key=p_key;
 if found then if prior.actor_id<>auth.uid() or prior.fingerprint<>fp then raise exception using errcode='22023',message='Khóa yêu cầu đã dùng';end if;return prior.run_id;end if;
 select id into rid from public.maintenance_requisition_runs where workspace_id=p_workspace and created_by=auth.uid() and fingerprint=fp;
 if rid is not null then insert into private.maintenance_requisition_requests values(p_key,auth.uid(),fp,rid);return rid;end if;
 for r in select value from jsonb_array_elements(p_rows) order by value->>'equipmentId' loop
  if not r ?& array['equipmentId','equipmentCode','sourceLabel','group','maintenanceLevel','materials'] or jsonb_typeof(r->'materials')<>'array' or jsonb_array_length(r->'materials') not between 1 and 20 then raise exception using errcode='22023',message='Sai dòng kế hoạch';end if;
  select * into e from public.equipment where id=(r->>'equipmentId')::uuid and workspace_id=p_workspace for update;
  if not found or e.code is distinct from r->>'equipmentCode' or e.base_status='decommissioned' or e.id=any(seen) then raise exception using errcode='22023',message='Phương tiện không khớp hoặc bị trùng';end if;
  seen:=array_append(seen,e.id);select case_id into cid from private.maintenance_requisition_cases where equipment_id=e.id and planned_day=p_day;
  if cid is null then
   summary_text:='Kế hoạch bảo dưỡng '||p_day::text||' · '||(r->>'maintenanceLevel');cid:=private.create_case(e.id,'maintenance',p_day::timestamp at time zone 'Asia/Bangkok',null,summary_text,gen_random_uuid());
   update public.work_cases set tracking_only=true where id=cid;insert into public.repair_orders(equipment_id,code,title,case_id) values(e.id,'AUTO',summary_text,cid) returning id into oid;
   insert into public.repair_work_items(repair_order_id,item_no,symptom,solution_plan,performed_on) values(oid,1,summary_text,'Theo kế hoạch đã lưu; chưa xác nhận thực hiện',p_day);
   insert into public.case_material_followups(case_id) values(cid);insert into private.maintenance_requisition_cases values(e.id,p_day,cid);
  end if;
  saved:=saved||jsonb_build_array(r||jsonb_build_object('equipmentName',e.name,'caseId',cid,'caseCode',(select code from public.work_cases where id=cid)));
 end loop;
 insert into public.maintenance_requisition_runs(workspace_id,planned_day,grouping_mode,snapshot,created_by,fingerprint) values(p_workspace,p_day,p_grouping,jsonb_build_object('version',1,'rows',saved,'print',p_print),auth.uid(),fp) returning id into rid;
 insert into private.maintenance_requisition_requests values(p_key,auth.uid(),fp,rid);return rid;
end;$$;
create or replace function public.save_maintenance_requisition(p_workspace uuid,p_day date,p_grouping text,p_rows jsonb,p_print jsonb,p_key uuid)
returns uuid language sql security invoker set search_path='' as $$select private.save_maintenance_requisition(p_workspace,p_day,p_grouping,p_rows,p_print,p_key)$$;
revoke execute on function private.save_maintenance_requisition(uuid,date,text,jsonb,jsonb,uuid),public.save_maintenance_requisition(uuid,date,text,jsonb,jsonb,uuid) from public,anon;
grant execute on function private.save_maintenance_requisition(uuid,date,text,jsonb,jsonb,uuid),public.save_maintenance_requisition(uuid,date,text,jsonb,jsonb,uuid) to authenticated;
commit;
