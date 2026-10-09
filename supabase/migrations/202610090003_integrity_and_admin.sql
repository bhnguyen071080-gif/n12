begin;
alter table public.equipment add column status text not null default 'available'
 check(status in ('available','in_repair','maintenance','stopped','stopped_waiting_material','decommissioned'));
create function private.guard_derived_status() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and new.status is distinct from old.status and current_user<>'postgres' then
  raise exception using errcode='42501',message='Trạng thái PTTB được tính từ nghiệp vụ';
 end if;
 return new;
end; $$;
create trigger derived_status_guard before update on public.equipment for each row execute function private.guard_derived_status();
create function private.refresh_equipment(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare s text;
begin
 select case
 when e.base_status='decommissioned' then 'decommissioned'
 when exists(select 1 from public.equipment_downtimes d join public.repair_orders r on r.id=d.repair_order_id
 join public.repair_work_items i on i.repair_order_id=r.id
 where d.equipment_id=e.id and d.ended_at is null and r.closed_at is null and r.cancelled_at is null and i.material_status='procurement_pending')
 then 'stopped_waiting_material'
 when exists(select 1 from public.work_cases c where c.equipment_id=e.id and c.kind='maintenance' and c.actual_ended_at is null)
 then 'maintenance'
 when exists(select 1 from public.equipment_downtimes d where d.equipment_id=e.id and d.ended_at is null)
 or exists(select 1 from public.repair_orders r join public.repair_work_items i on i.repair_order_id=r.id
 where r.equipment_id=e.id and r.closed_at is null and r.cancelled_at is null and i.execution_status='in_progress')
 then 'in_repair' else e.base_status end into s from public.equipment e where e.id=p_id;
 update public.equipment set status=s where id=p_id and status is distinct from s;
end; $$;
create function private.refresh_related_equipment() returns trigger language plpgsql security definer set search_path='' as $$
declare d jsonb; eid uuid; rid uuid; pass integer;
begin
 for pass in 1..2 loop
  if pass=1 and tg_op='INSERT' or pass=2 and tg_op='DELETE' then continue; end if;
  d:=case when pass=1 then to_jsonb(old) else to_jsonb(new) end;
  if tg_table_name='equipment' then eid:=(d->>'id')::uuid;
  elsif tg_table_name='repair_work_items' then
   rid:=(d->>'repair_order_id')::uuid; select equipment_id into eid from public.repair_orders where id=rid;
  else eid:=(d->>'equipment_id')::uuid; end if;
  perform private.refresh_equipment(eid);
 end loop;
 return case when tg_op='DELETE' then old else new end;
end; $$;
create trigger equipment_status_refresh after insert or update of base_status on public.equipment for each row execute function private.refresh_related_equipment();
do $$ declare t text; begin
 foreach t in array array['repair_orders','repair_work_items','equipment_downtimes','work_cases'] loop
  execute format('create trigger equipment_status_refresh after insert or update or delete on public.%I for each row execute function private.refresh_related_equipment()',t);
 end loop;
end; $$;
create unique index one_active_downtime on public.equipment_downtimes(equipment_id) where ended_at is null;
create function private.guard_downtime() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.repair_order_id is not null and not exists(select 1 from public.repair_orders r where r.id=new.repair_order_id and r.equipment_id=new.equipment_id) then
  raise exception using errcode='22023',message='Thời gian dừng phải cùng phương tiện với hồ sơ'; end if;
 if tg_op='UPDATE' and (new.id<>old.id or new.equipment_id<>old.equipment_id or new.repair_order_id is distinct from old.repair_order_id) then
  raise exception using errcode='42501',message='Không được chuyển bản ghi dừng máy'; end if;
 return new;
end; $$;
create trigger downtime_guard before insert or update on public.equipment_downtimes for each row execute function private.guard_downtime();
create function private.guard_catalogue_identity() returns trigger language plpgsql set search_path='' as $$
begin
 if new.id<>old.id or new.workspace_id<>old.workspace_id or new.code<>old.code then
  raise exception using errcode='42501',message='Mã danh mục và workspace là bất biến'; end if;
 return new;
end; $$;
create trigger material_identity before update on public.materials for each row execute function private.guard_catalogue_identity();
create trigger warehouse_identity before update on public.warehouses for each row execute function private.guard_catalogue_identity();

create function private.set_member_roles(p_workspace uuid,p_user uuid,p_roles public.eam_role[])
returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.has_role(p_workspace,array['TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then
  raise exception using errcode='42501',message='Không có quyền quản trị thành viên'; end if;
 if p_user is null or p_roles is null or cardinality(p_roles)=0 or array_position(p_roles,null) is not null then
  raise exception using errcode='22023',message='Phải có ít nhất một vai trò'; end if;
 perform 1 from public.workspaces where id=p_workspace for update;
 if exists(select 1 from public.workspace_memberships m where m.workspace_id=p_workspace and m.user_id=p_user
  and m.role='TRUONG_BO_PHAN_KY_THUAT' and m.active)
 and not ('TRUONG_BO_PHAN_KY_THUAT'::public.eam_role=any(p_roles))
 and not exists(select 1 from public.workspace_memberships m where m.workspace_id=p_workspace and m.user_id<>p_user
  and m.role='TRUONG_BO_PHAN_KY_THUAT' and m.active) then
  raise exception using errcode='22023',message='Không được bỏ trưởng bộ phận cuối cùng';
 end if;
 delete from public.workspace_memberships where workspace_id=p_workspace and user_id=p_user;
 insert into public.workspace_memberships(workspace_id,user_id,role)
 select p_workspace,p_user,r from (select distinct unnest(p_roles) r) roles;
end; $$;
create function public.set_member_roles(p_workspace uuid,p_user uuid,p_roles public.eam_role[])
returns void language sql security invoker set search_path='' as $$ select private.set_member_roles(p_workspace,p_user,p_roles); $$;

create table private.stock_requests (
 request_key uuid primary key, actor_id uuid not null references auth.users(id),
 fingerprint text not null, voucher_id uuid not null references public.vouchers(id)
);
create function private.post_stock(p_warehouse uuid,p_material uuid,p_delta numeric,p_reason text,p_key uuid,p_usage uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare w public.warehouses; previous private.stock_requests; fp text; vid uuid:=gen_random_uuid(); balance numeric;
begin
 select * into strict w from public.warehouses where id=p_warehouse for update;
 if not private.has_role(w.workspace_id,array['CAN_BO_VAT_TU','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then
  raise exception using errcode='42501',message='Không có quyền ghi sổ kho'; end if;
 if p_delta is null or p_delta=0 or p_delta<>round(p_delta,3) or p_key is null or p_reason is null or length(btrim(p_reason))=0 or not exists(
  select 1 from public.materials m where m.id=p_material and m.workspace_id=w.workspace_id
 ) then raise exception using errcode='22023',message='Bút toán kho không hợp lệ'; end if;
 fp:=md5(jsonb_build_array(p_warehouse,p_material,p_delta,p_reason,p_usage)::text);
 select * into previous from private.stock_requests where request_key=p_key;
 if found then
  if previous.actor_id<>auth.uid() or previous.fingerprint<>fp then
   raise exception using errcode='22023',message='Khóa bút toán đã sử dụng'; end if;
  return previous.voucher_id;
 end if;
 -- Serialize allocations to one usage even when posted from different warehouses.
 if p_usage is not null then perform 1 from public.repair_material_usages where id=p_usage for update; end if;
 if p_usage is not null and (p_delta>=0 or not exists(
  select 1 from public.repair_material_usages u where u.id=p_usage and u.material_id=p_material
  and private.can_item(u.repair_work_item_id,array['CAN_BO_VAT_TU','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[])
 )) then raise exception using errcode='22023',message='Phiếu lĩnh không khớp vật tư sử dụng'; end if;
 select coalesce(sum(l.quantity_delta),0) into balance from public.voucher_lines l
 join public.vouchers v on v.id=l.voucher_id where v.warehouse_id=p_warehouse and l.material_id=p_material;
 if balance+p_delta<0 then raise exception using errcode='22023',message='Không đủ tồn kho'; end if;
 if p_usage is not null and (
  select coalesce(-sum(l.quantity_delta),0)-p_delta>u.quantity
  from public.repair_material_usages u left join public.voucher_lines l on l.usage_id=u.id
  where u.id=p_usage group by u.id
 ) then raise exception using errcode='22023',message='Lĩnh vượt số lượng vật tư sử dụng'; end if;
 insert into public.vouchers(id,warehouse_id,code,request_key) values(vid,p_warehouse,private.next_code(w.workspace_id,'PX'),p_key);
 insert into public.voucher_lines(voucher_id,material_id,usage_id,quantity_delta,reason)
 values(vid,p_material,p_usage,p_delta,p_reason);
 insert into private.stock_requests values(p_key,auth.uid(),fp,vid);
 return vid;
end; $$;
create function public.post_stock_movement(p_warehouse uuid,p_material uuid,p_delta numeric,p_reason text,p_key uuid,p_usage uuid default null)
returns uuid language sql security invoker set search_path='' as $$ select private.post_stock(p_warehouse,p_material,p_delta,p_reason,p_key,p_usage); $$;

-- Preserve repair history that has no work-case link (legacy/manual repairs).
drop view public.vw_equipment_history;
create view public.vw_equipment_history with(security_invoker=true) as
with base as (
 select c.id::text as event_key,c.equipment_id,c.code as case_code,c.kind::text as event_type,
 c.actual_started_at as event_at,c.actual_ended_at,c.summary as title,r.id as order_id,r.code as order_code
 from public.work_cases c left join public.repair_orders r on r.case_id=c.id
 union all
 select 'repair:'||r.id,r.equipment_id,null,'repair',r.opened_at,r.closed_at,r.title,r.id,r.code
 from public.repair_orders r where r.case_id is null
)
select b.*,
 coalesce((select jsonb_agg(jsonb_build_object('symptom',i.symptom,'root_cause',i.root_cause,
 'solution_plan',i.solution_plan,'execution_result',i.execution_result,
 'basis_status',i.basis_status,'material_status',i.material_status,'requisition_status',i.requisition_status,
 'execution_status',i.execution_status,'acceptance_status',i.acceptance_status,'dossier_status',i.dossier_status,
 'materials',(select coalesce(jsonb_agg(jsonb_build_object('code',m.code,'name',m.name,'quantity',u.quantity,
 'unit',m.unit,'installed_at',u.installed_at,'document_status',u.document_status)),'[]'::jsonb)
 from public.repair_material_usages u join public.materials m on m.id=u.material_id where u.repair_work_item_id=i.id)
 ) order by i.item_no) from public.repair_work_items i where i.repair_order_id=b.order_id),'[]'::jsonb) as work_items,
 coalesce((select sum(extract(epoch from upper(s.r)-lower(s.r))/3600)
 from (select unnest(range_agg(tstzrange(d.started_at,coalesce(d.ended_at,now()),'[)'))) as r
 from public.equipment_downtimes d where d.repair_order_id=b.order_id) s),0) as downtime_hours
from base b;
revoke all on public.vw_equipment_history from anon;
grant select on public.vw_equipment_history to authenticated;
revoke execute on all functions in schema private from public,anon;
revoke execute on function public.set_member_roles(uuid,uuid,public.eam_role[]),
public.post_stock_movement(uuid,uuid,numeric,text,uuid,uuid) from public,anon;
grant execute on function private.set_member_roles(uuid,uuid,public.eam_role[]),private.post_stock(uuid,uuid,numeric,text,uuid,uuid),
public.set_member_roles(uuid,uuid,public.eam_role[]),public.post_stock_movement(uuid,uuid,numeric,text,uuid,uuid) to authenticated;
commit;
