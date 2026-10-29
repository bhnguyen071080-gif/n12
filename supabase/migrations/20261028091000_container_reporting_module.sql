-- Monthly/yearly container reporting for TK (TUKAN), QC and RTG only.
begin;

create type public.container_report_status as enum ('draft','summarized','checked','locked');

-- An active system administrator is a super-role inside the same workspace.
create or replace function private.has_role(p_workspace uuid, p_roles public.eam_role[])
returns boolean language sql stable security definer set search_path=''
as $$
 select auth.uid() is not null and exists (
  select 1 from public.workspace_memberships m
  where m.workspace_id=p_workspace and m.user_id=auth.uid() and m.active
   and (m.role=any(p_roles) or m.role='QUAN_TRI_HE_THONG'::public.eam_role)
 );
$$;

alter table public.monthly_production
 add column status public.container_report_status not null default 'summarized',
 add column notes text not null default '',
 add column compiler_name text not null default 'Dữ liệu đã tổng hợp trước nâng cấp',
 add column created_by uuid references auth.users(id),
 add column created_at timestamptz not null default now(),
 add column checked_by uuid references auth.users(id),
 add column checked_at timestamptz,
 add column locked_by uuid references auth.users(id),
 add column locked_at timestamptz,
 add column cancelled_by uuid references auth.users(id),
 add column cancelled_at timestamptz,
 add column cancel_reason text,
 add column admin_action_reason text,
 add column anomaly_acknowledged boolean not null default false,
 add column version_no integer not null default 1 check(version_no>0);

-- Preserve historical actor/time without letting the normal app-write stamp
-- replace updated_by with NULL while migrations run outside an auth session.
alter table public.monthly_production disable trigger monthly_production_stamp;
update public.monthly_production
set status='summarized', created_by=updated_by, created_at=updated_at
where created_by is null;
alter table public.monthly_production enable trigger monthly_production_stamp;

alter table public.monthly_production alter column created_by set default auth.uid();
create index monthly_production_active_month_idx on public.monthly_production(month,equipment_id) where cancelled_at is null;
create index monthly_production_status_idx on public.monthly_production(status,month) where cancelled_at is null;
create table private.container_report_requests (
 request_key uuid primary key, actor_id uuid not null references auth.users(id),
 fingerprint text not null, record_id uuid not null references public.monthly_production(id), created_at timestamptz not null default now()
);

create function private.guard_container_report()
returns trigger language plpgsql security definer set search_path='' as $$
declare e public.equipment;
begin
 if tg_op='DELETE' then
  raise exception using errcode='42501',message='Không xóa cứng số liệu container; quản trị viên phải dùng tác vụ hủy có lý do';
 end if;
 select * into strict e from public.equipment where id=new.equipment_id;
 if tg_op='INSERT' then
  new.created_by:=coalesce(new.created_by,auth.uid());
  new.created_at:=coalesce(new.created_at,now());
  if new.compiler_name='Dữ liệu đã tổng hợp trước nâng cấp' then
   new.compiler_name:=coalesce(nullif(current_setting('request.jwt.claim.email',true),''),'Người dùng '||left(auth.uid()::text,8));
  end if;
  new.version_no:=1;
 else
  if new.id<>old.id or new.equipment_id<>old.equipment_id or new.month<>old.month
   or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
   raise exception using errcode='42501',message='Không được đổi mã, phương tiện, kỳ báo cáo hoặc người tạo';
  end if;
  if old.cancelled_at is not null then
   raise exception using errcode='22023',message='Bản ghi đã hủy được giữ làm lịch sử và không thể sửa';
  end if;
  if old.status='locked' and (
   new.boxes is distinct from old.boxes or new.notes is distinct from old.notes
   or new.status not in ('locked','summarized') or new.cancelled_at is not null
  ) then
   if not private.has_role(e.workspace_id,array['QUAN_TRI_HE_THONG']::public.eam_role[])
    or length(btrim(coalesce(new.admin_action_reason,'')))<5 then
    raise exception using errcode='42501',message='Bản ghi đã khóa; chỉ quản trị hệ thống được mở khóa hoặc hủy và phải nêu lý do';
   end if;
  end if;
  new.version_no:=old.version_no+1;
 end if;
 if new.cancelled_at is not null and length(btrim(coalesce(new.cancel_reason,'')))<5 then
  raise exception using errcode='22023',message='Phải nhập lý do hủy ít nhất 5 ký tự';
 end if;
 return new;
end; $$;
create trigger container_report_guard before insert or update or delete on public.monthly_production
 for each row execute function private.guard_container_report();

-- All writes go through audited functions below; table reads remain protected by RLS.
drop policy if exists monthly_delete on public.monthly_production;
revoke insert,update,delete on public.monthly_production from authenticated,anon,public;

create function private.container_anomaly(p_equipment uuid,p_month date,p_boxes bigint)
returns text language sql stable security definer set search_path='' as $$
 with prior as (
  select p.boxes,p.month from public.monthly_production p
  where p.equipment_id=p_equipment and p.month<p_month and p.month>=p_month-interval '3 months'
   and p.cancelled_at is null order by p.month desc
 ), a as (select avg(boxes)::numeric avg_boxes,count(*) n from prior)
 select case
  when p_boxes=0 and exists(select 1 from prior where month=p_month-interval '1 month' and boxes>0)
   then 'zero_after_positive'
 when (select n from a)=3 and (select avg_boxes from a)>0
   and abs(p_boxes-(select avg_boxes from a))/(select avg_boxes from a)>.5
   then 'change_over_50_pct'
  else null end;
$$;

create function private.save_container_report_month(
 p_workspace uuid,p_id uuid,p_expected_version integer,p_equipment uuid,p_month date,p_boxes bigint,
 p_notes text,p_status text,p_anomaly_acknowledged boolean,p_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare e public.equipment; r public.monthly_production; anomaly text; actor_name text; result_id uuid;
 fp text; prior private.container_report_requests;
begin
 if not private.has_role(p_workspace,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then
  raise exception using errcode='42501',message='Không có quyền nhập số liệu container'; end if;
 if p_key is null or p_month is null or extract(day from p_month)<>1 or p_boxes is null or p_boxes<0
  or p_status not in ('draft','summarized') then
  raise exception using errcode='22023',message='Thiếu hoặc sai kỳ báo cáo, số container hay trạng thái'; end if;
 fp:=md5(jsonb_build_array(p_id,p_expected_version,p_equipment,p_month,p_boxes,p_notes,p_status,p_anomaly_acknowledged)::text);
 select * into prior from private.container_report_requests where request_key=p_key;
 if found then
  if prior.actor_id<>auth.uid() or prior.fingerprint<>fp then
   raise exception using errcode='22023',message='Khóa yêu cầu đã dùng cho nội dung khác'; end if;
  return prior.record_id;
 end if;
 select * into strict e from public.equipment where id=p_equipment and workspace_id=p_workspace for update;
 if e.category not in ('TUKAN','QC','RTG') then
  raise exception using errcode='22023',message='Chỉ chọn phương tiện nhóm TK, QC hoặc RTG'; end if;
 anomaly:=private.container_anomaly(p_equipment,p_month,p_boxes);
 if anomaly is not null and not coalesce(p_anomaly_acknowledged,false) then
  raise exception using errcode='P0001',message='Số liệu bất thường; cần xác nhận đã đối chiếu trước khi lưu'; end if;
 actor_name:=coalesce(nullif(current_setting('request.jwt.claim.email',true),''),'Người dùng '||left(auth.uid()::text,8));
 if p_id is null then
  if exists(select 1 from public.monthly_production where equipment_id=p_equipment and month=p_month) then
   raise exception using errcode='23505',message='Đã có số liệu cho phương tiện và kỳ báo cáo này'; end if;
  insert into public.monthly_production(equipment_id,month,boxes,status,notes,compiler_name,created_by,anomaly_acknowledged)
  values(p_equipment,p_month,p_boxes,p_status::public.container_report_status,left(btrim(coalesce(p_notes,'')),2000),actor_name,auth.uid(),coalesce(p_anomaly_acknowledged,false))
  returning id into result_id;
 else
  select * into strict r from public.monthly_production where id=p_id and equipment_id=p_equipment and month=p_month for update;
  if p_expected_version is null or r.version_no<>p_expected_version then
   raise exception using errcode='40001',message='Dữ liệu đã thay đổi; tải lại trước khi sửa'; end if;
  if r.status='locked' or r.cancelled_at is not null then
   raise exception using errcode='42501',message='Bản ghi đã khóa hoặc đã hủy'; end if;
  update public.monthly_production set boxes=p_boxes,status=p_status::public.container_report_status,
   notes=left(btrim(coalesce(p_notes,'')),2000),compiler_name=actor_name,
   anomaly_acknowledged=coalesce(p_anomaly_acknowledged,false),checked_by=null,checked_at=null,locked_by=null,locked_at=null
  where id=p_id returning id into result_id;
 end if;
 insert into private.container_report_requests(request_key,actor_id,fingerprint,record_id)
 values(p_key,auth.uid(),fp,result_id);
 return result_id;
end; $$;

create function private.set_container_report_status(p_id uuid,p_expected_version integer,p_status text)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.monthly_production; w uuid;
begin
 select p.* into r from public.monthly_production p where p.id=p_id for update;
 if not found then raise exception using errcode='P0002',message='Không tìm thấy bản ghi'; end if;
 select e.workspace_id into w from public.equipment e where e.id=r.equipment_id;
 if not private.has_role(w,array['TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then
  raise exception using errcode='42501',message='Chỉ quản lý kỹ thuật được kiểm tra và khóa số liệu'; end if;
 if r.version_no<>p_expected_version or r.cancelled_at is not null then
  raise exception using errcode='40001',message='Dữ liệu đã thay đổi hoặc đã hủy'; end if;
 if p_status='checked' and r.status in ('draft','summarized') then
  update public.monthly_production set status='checked',checked_by=auth.uid(),checked_at=now() where id=p_id;
 elsif p_status='locked' and r.status='checked' then
  update public.monthly_production set status='locked',locked_by=auth.uid(),locked_at=now() where id=p_id;
 else raise exception using errcode='22023',message='Chuyển trạng thái không hợp lệ'; end if;
 return p_id;
end; $$;

create function private.admin_reopen_container_report(p_id uuid,p_expected_version integer,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.monthly_production; w uuid;
begin
 select * into strict r from public.monthly_production where id=p_id for update;
 select workspace_id into strict w from public.equipment where id=r.equipment_id;
 if not private.has_role(w,array['QUAN_TRI_HE_THONG']::public.eam_role[]) then raise exception using errcode='42501',message='Chỉ quản trị hệ thống được mở khóa'; end if;
 if r.version_no<>p_expected_version or r.status<>'locked' or r.cancelled_at is not null or length(btrim(coalesce(p_reason,'')))<5 then
  raise exception using errcode='22023',message='Phiên bản, trạng thái hoặc lý do mở khóa không hợp lệ'; end if;
 update public.monthly_production set status='summarized',locked_by=null,locked_at=null,checked_by=null,checked_at=null,
  admin_action_reason='Mở khóa: '||left(btrim(p_reason),500) where id=p_id;
 return p_id;
end; $$;

create function private.admin_cancel_container_report(p_id uuid,p_expected_version integer,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.monthly_production; w uuid;
begin
 select * into strict r from public.monthly_production where id=p_id for update;
 select workspace_id into strict w from public.equipment where id=r.equipment_id;
 if not private.has_role(w,array['QUAN_TRI_HE_THONG']::public.eam_role[]) then raise exception using errcode='42501',message='Chỉ quản trị hệ thống được hủy'; end if;
 if r.version_no<>p_expected_version or r.cancelled_at is not null or length(btrim(coalesce(p_reason,'')))<5 then
  raise exception using errcode='22023',message='Phiên bản hoặc lý do hủy không hợp lệ'; end if;
 update public.monthly_production set cancelled_at=now(),cancelled_by=auth.uid(),cancel_reason=left(btrim(p_reason),500),
  admin_action_reason='Hủy: '||left(btrim(p_reason),500) where id=p_id;
 return p_id;
end; $$;

create function public.save_container_report_month(p_workspace uuid,p_id uuid,p_expected_version integer,p_equipment uuid,p_month date,p_boxes bigint,p_notes text,p_status text,p_anomaly_acknowledged boolean,p_key uuid)
returns uuid language sql security invoker set search_path='' as $$
 select private.save_container_report_month(p_workspace,p_id,p_expected_version,p_equipment,p_month,p_boxes,p_notes,p_status,p_anomaly_acknowledged,p_key);
$$;
create function public.set_container_report_status(p_id uuid,p_expected_version integer,p_status text)
returns uuid language sql security invoker set search_path='' as $$ select private.set_container_report_status(p_id,p_expected_version,p_status); $$;
create function public.admin_reopen_container_report(p_id uuid,p_expected_version integer,p_reason text)
returns uuid language sql security invoker set search_path='' as $$ select private.admin_reopen_container_report(p_id,p_expected_version,p_reason); $$;
create function public.admin_cancel_container_report(p_id uuid,p_expected_version integer,p_reason text)
returns uuid language sql security invoker set search_path='' as $$ select private.admin_cancel_container_report(p_id,p_expected_version,p_reason); $$;

create view public.vw_container_report_monthly with(security_invoker=true) as
select p.id,e.workspace_id,e.id equipment_id,e.code equipment_code,e.name equipment_name,
 case when e.category='TUKAN' then 'TK' else e.category end equipment_group,
 p.month,p.boxes,p.status::text,p.notes,p.compiler_name,p.created_at,p.updated_at,p.version_no,
 p.anomaly_acknowledged,p.cancelled_at,p.cancel_reason,p.admin_action_reason,
 private.container_anomaly(p.equipment_id,p.month,p.boxes) anomaly_kind
from public.monthly_production p join public.equipment e on e.id=p.equipment_id
where e.category in ('TUKAN','QC','RTG');

revoke all on public.vw_container_report_monthly from public,anon;
grant select on public.vw_container_report_monthly to authenticated;
revoke execute on function private.container_anomaly(uuid,date,bigint),private.save_container_report_month(uuid,uuid,integer,uuid,date,bigint,text,text,boolean,uuid),private.set_container_report_status(uuid,integer,text),private.admin_reopen_container_report(uuid,integer,text),private.admin_cancel_container_report(uuid,integer,text) from public,anon;
grant execute on function private.has_role(uuid,public.eam_role[]),private.container_anomaly(uuid,date,bigint),private.save_container_report_month(uuid,uuid,integer,uuid,date,bigint,text,text,boolean,uuid),private.set_container_report_status(uuid,integer,text),private.admin_reopen_container_report(uuid,integer,text),private.admin_cancel_container_report(uuid,integer,text) to authenticated;
revoke execute on function public.save_container_report_month(uuid,uuid,integer,uuid,date,bigint,text,text,boolean,uuid),public.set_container_report_status(uuid,integer,text),public.admin_reopen_container_report(uuid,integer,text),public.admin_cancel_container_report(uuid,integer,text) from public,anon;
grant execute on function public.save_container_report_month(uuid,uuid,integer,uuid,date,bigint,text,text,boolean,uuid),public.set_container_report_status(uuid,integer,text),public.admin_reopen_container_report(uuid,integer,text),public.admin_cancel_container_report(uuid,integer,text) to authenticated;

commit;
