-- Preserve business evidence: a case is corrected in place or cancelled with a reason,
-- never hard-deleted. All changes continue to flow through the existing audit trigger.
begin;

alter table public.repair_orders
 add column if not exists cancel_reason text,
 add column if not exists cancelled_by uuid references auth.users(id);

update public.repair_orders
 set cancel_reason=coalesce(cancel_reason,'Hồ sơ đã hủy trước khi hệ thống yêu cầu ghi lý do'),
     cancelled_by=coalesce(cancelled_by,created_by)
 where cancelled_at is not null;

create index if not exists repair_orders_cancelled_by_idx on public.repair_orders(cancelled_by);

alter table public.repair_orders
 drop constraint if exists repair_orders_cancellation_details_valid;
alter table public.repair_orders
 add constraint repair_orders_cancellation_details_valid check(
  (cancelled_at is null and cancel_reason is null and cancelled_by is null) or
  (cancelled_at is not null and length(btrim(cancel_reason)) between 5 and 500 and cancelled_by is not null)
 );

create or replace function private.guard_order_cancellation_details()
returns trigger language plpgsql set search_path='' as $$
begin
 if old.cancelled_at is not null and row(new.cancelled_at,new.cancel_reason,new.cancelled_by)
  is distinct from row(old.cancelled_at,old.cancel_reason,old.cancelled_by) then
  raise exception using errcode='42501',message='Thông tin hủy đã khóa; xem nhật ký thay vì sửa lại';
 end if;
 return new;
end;$$;
revoke all on function private.guard_order_cancellation_details() from public,anon,authenticated;
drop trigger if exists order_cancellation_details_guard on public.repair_orders;
create trigger order_cancellation_details_guard before update on public.repair_orders
 for each row execute function private.guard_order_cancellation_details();

create or replace function private.save_tracking_case_summary(p_case uuid,p_expected text,p_summary text)
returns void language plpgsql security definer set search_path='' as $$
declare c public.work_cases;r public.repair_orders;clean text;
begin
 select * into strict c from public.work_cases where id=p_case for update;
 select * into strict r from public.repair_orders where case_id=p_case for update;
 if not c.tracking_only or not private.can_equipment(c.equipment_id,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then
  raise exception using errcode='42501',message='Không có quyền sửa vụ việc';
 end if;
 if r.cancelled_at is not null then raise exception using errcode='22023',message='Vụ việc đã hủy';end if;
 clean:=btrim(coalesce(p_summary,''));
 if length(clean) not between 1 and 8000 then raise exception using errcode='22023',message='Nội dung không hợp lệ';end if;
 if c.summary is distinct from p_expected then
  if c.summary=clean then return;end if;
  raise exception using errcode='40001',message='Vụ việc đã thay đổi';
 end if;
 update public.work_cases set summary=clean where id=c.id;
 update public.repair_orders set title=clean where id=r.id;
end;$$;

create or replace function public.save_tracking_case_summary(p_case uuid,p_expected text,p_summary text)
returns void language sql security invoker set search_path='' as $$
 select private.save_tracking_case_summary(p_case,p_expected,p_summary)
$$;

create or replace function private.cancel_tracking_case(p_case uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare c public.work_cases;r public.repair_orders;clean text;
begin
 select * into strict c from public.work_cases where id=p_case for update;
 select * into strict r from public.repair_orders where case_id=p_case for update;
 if not c.tracking_only or not private.can_equipment(c.equipment_id,array['TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then
  raise exception using errcode='42501',message='Chỉ trưởng bộ phận được hủy vụ việc';
 end if;
 clean:=btrim(coalesce(p_reason,''));
 if length(clean) not between 5 and 500 then raise exception using errcode='22023',message='Cần ghi lý do hủy từ 5 đến 500 ký tự';end if;
 if r.cancelled_at is not null then
  if r.cancel_reason=clean then return;end if;
  raise exception using errcode='40001',message='Vụ việc đã được hủy với lý do khác';
 end if;
 update public.repair_orders set cancelled_at=now(),cancel_reason=clean,cancelled_by=auth.uid() where id=r.id;
end;$$;

create or replace function public.cancel_tracking_case(p_case uuid,p_reason text)
returns void language sql security invoker set search_path='' as $$
 select private.cancel_tracking_case(p_case,p_reason)
$$;

revoke execute on function private.save_tracking_case_summary(uuid,text,text),public.save_tracking_case_summary(uuid,text,text) from public,anon;
revoke execute on function private.cancel_tracking_case(uuid,text),public.cancel_tracking_case(uuid,text) from public,anon;
grant execute on function private.save_tracking_case_summary(uuid,text,text),public.save_tracking_case_summary(uuid,text,text) to authenticated;
grant execute on function private.cancel_tracking_case(uuid,text),public.cancel_tracking_case(uuid,text) to authenticated;

comment on column public.repair_orders.cancel_reason is 'Lý do hủy bắt buộc; giữ cùng hồ sơ và audit log, không xóa vật lý.';
comment on function public.save_tracking_case_summary(uuid,text,text) is 'Sửa nội dung khái quát với kiểm tra xung đột.';
comment on function public.cancel_tracking_case(uuid,text) is 'Hủy mềm vụ việc, chỉ trưởng bộ phận; không xóa chứng cứ.';

commit;

