-- Fresh TV-EAM foundation. Do not apply over the untested SQL from the chat.
begin;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create type public.eam_role as enum ('DOI_SAN_XUAT','KY_THUAT_VIEN','CAN_BO_VAT_TU','TRUONG_BO_PHAN_KY_THUAT');
create type public.basis_progress as enum ('incident_code_assigned','minutes_in_progress','no_basis');
create type public.material_progress as enum ('stock_available','borrowed','procurement_pending','not_required');
create type public.requisition_progress as enum ('requisition_created','temporary_issue_debt','approval_pending','not_applicable');
create type public.execution_progress as enum ('completed','in_progress','waiting_shutdown');
create type public.acceptance_progress as enum ('accepted','pending','rework_required');
create type public.dossier_progress as enum ('closed','missing_reimbursement_documents','collecting');
create type public.material_document_progress as enum ('urgent_borrow','requisition_created','warehouse_issued','installed','documents_complete');

create table public.workspaces (
 id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz not null default now()
);
create table public.workspace_memberships (
 workspace_id uuid not null references public.workspaces(id), user_id uuid not null references auth.users(id),
 role public.eam_role not null, active boolean not null default true,
 primary key(workspace_id,user_id,role)
);
create table public.equipment (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
 code text not null check(code ~ '^[A-Z0-9_-]{1,40}$'), name text not null,
 category text not null check(category in ('QC','RTG','TUKAN','FORKLIFT','TRACTOR','TRAILER','AUXILIARY')),
 base_status text not null default 'available' check(base_status in ('available','stopped','decommissioned')),
 initial_hours numeric(18,2) not null default 0 check(initial_hours >= 0),
 accumulated_hours numeric(18,2) not null default 0 check(accumulated_hours >= 0),
 created_at timestamptz not null default now(), unique(workspace_id,code)
);
create table public.equipment_specs (
 equipment_id uuid not null references public.equipment(id), spec_code text not null,
 label text not null, value text not null, unit text, primary key(equipment_id,spec_code)
);
create table private.document_counters (
 workspace_id uuid not null references public.workspaces(id), prefix text not null,
 counter_year integer not null, last_value bigint not null, primary key(workspace_id,prefix,counter_year)
);
create table public.repair_orders (
 id uuid primary key default gen_random_uuid(), equipment_id uuid not null references public.equipment(id),
 code text not null, title text not null check(length(btrim(title)) > 0),
 opened_at timestamptz not null default now(), closed_at timestamptz,
 cancelled_at timestamptz, created_by uuid not null default auth.uid() references auth.users(id),
 unique(equipment_id,code)
);
create table public.repair_work_items (
 id uuid primary key default gen_random_uuid(), repair_order_id uuid not null references public.repair_orders(id),
 item_no integer not null check(item_no>0),
 symptom text not null default '', root_cause text not null default '',
 solution_plan text not null default '', execution_result text not null default '',
 basis_status public.basis_progress not null default 'no_basis',
 material_status public.material_progress not null default 'procurement_pending',
 requisition_status public.requisition_progress not null default 'not_applicable',
 execution_status public.execution_progress not null default 'waiting_shutdown',
 acceptance_status public.acceptance_progress not null default 'pending',
 dossier_status public.dossier_progress not null default 'collecting',
 completed_at timestamptz, unique(repair_order_id,item_no)
);
create table public.materials (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
 code text not null, name text not null, unit text not null,
 minimum_stock numeric(18,3) not null default 0 check(minimum_stock>=0), unique(workspace_id,code)
);
create table public.warehouses (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
 code text not null, name text not null, unique(workspace_id,code)
);
create table public.repair_material_usages (
 id uuid primary key default gen_random_uuid(), repair_work_item_id uuid not null references public.repair_work_items(id),
 material_id uuid not null references public.materials(id), quantity numeric(18,3) not null check(quantity>0),
 document_status public.material_document_progress not null default 'urgent_borrow',
 lender text, borrowed_quantity numeric(18,3) not null default 0 check(borrowed_quantity>=0),
 returned_quantity numeric(18,3) not null default 0 check(returned_quantity>=0 and returned_quantity<=borrowed_quantity),
 installed_at timestamptz, notes text not null default ''
);
create table public.vouchers (
 id uuid primary key default gen_random_uuid(), warehouse_id uuid not null references public.warehouses(id),
 code text not null, posted_at timestamptz not null default now(),
 created_by uuid not null default auth.uid() references auth.users(id),
 request_key uuid not null unique
);
create table public.voucher_lines (
 id uuid primary key default gen_random_uuid(), voucher_id uuid not null references public.vouchers(id),
 material_id uuid not null references public.materials(id),
 usage_id uuid references public.repair_material_usages(id), quantity_delta numeric(18,3) not null check(quantity_delta<>0),
 reason text not null
);
create table public.equipment_downtimes (
 id uuid primary key default gen_random_uuid(), equipment_id uuid not null references public.equipment(id),
 repair_order_id uuid references public.repair_orders(id), started_at timestamptz not null,
 ended_at timestamptz, check(ended_at is null or ended_at>started_at)
);

create function private.has_role(p_workspace uuid, p_roles public.eam_role[])
returns boolean language sql stable security definer set search_path=''
as $$
 select auth.uid() is not null and exists (
  select 1 from public.workspace_memberships m
  where m.workspace_id=p_workspace and m.user_id=auth.uid() and m.active and m.role=any(p_roles)
 );
$$;
create function private.can_equipment(p_equipment uuid,p_roles public.eam_role[])
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.equipment e where e.id=p_equipment and private.has_role(e.workspace_id,p_roles)); $$;
create function private.can_order(p_order uuid,p_roles public.eam_role[])
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.repair_orders r where r.id=p_order and private.can_equipment(r.equipment_id,p_roles)); $$;
create function private.can_item(p_item uuid,p_roles public.eam_role[])
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.repair_work_items i where i.id=p_item and private.can_order(i.repair_order_id,p_roles)); $$;
create function private.next_code(p_workspace uuid,p_prefix text)
returns text language plpgsql security definer set search_path='' as $$
declare y integer := extract(year from now() at time zone 'Asia/Bangkok'); n bigint;
begin
 insert into private.document_counters values(p_workspace,p_prefix,y,1)
 on conflict(workspace_id,prefix,counter_year) do update set last_value=private.document_counters.last_value+1
 returning last_value into n;
 return p_prefix||'-'||y||'-'||lpad(n::text,greatest(4,length(n::text)),'0');
end; $$;
create function private.prepare_order()
returns trigger language plpgsql security definer set search_path='' as $$
declare w uuid;
begin
 select workspace_id into strict w from public.equipment where id=new.equipment_id;
 if tg_op='INSERT' then
  new.code:=private.next_code(w,'HS'); new.created_by:=auth.uid();
 else
  if new.equipment_id is distinct from old.equipment_id or new.code is distinct from old.code
     or new.created_by is distinct from old.created_by or new.opened_at is distinct from old.opened_at then
   raise exception using errcode='42501',message='Không được thay đổi định danh hồ sơ';
  end if;
  if new.closed_at is distinct from old.closed_at or new.cancelled_at is distinct from old.cancelled_at then
   if not private.has_role(w,array['TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then
    raise exception using errcode='42501',message='Chỉ trưởng bộ phận được đóng/hủy hồ sơ';
   end if;
   if new.closed_at is not null and (
    not exists(select 1 from public.repair_work_items where repair_order_id=new.id) or
    exists(select 1 from public.repair_work_items where repair_order_id=new.id and
      (acceptance_status<>'accepted' or dossier_status<>'closed'))
   ) then raise exception using errcode='22023',message='Chưa đủ nghiệm thu và chứng từ'; end if;
  end if;
 end if;
 return new;
end; $$;
create trigger order_guard before insert or update on public.repair_orders for each row execute function private.prepare_order();

create function private.guard_equipment()
returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then new.accumulated_hours:=new.initial_hours;
 else
  if new.id<>old.id or new.workspace_id<>old.workspace_id or new.code<>old.code then
   raise exception using errcode='42501',message='Không được thay đổi định danh PTTB';
  end if;
  if new.accumulated_hours is distinct from old.accumulated_hours and current_user<>'postgres' then
   raise exception using errcode='42501',message='Giờ lũy kế chỉ được cập nhật từ số liệu tháng';
  end if;
  if new.initial_hours is distinct from old.initial_hours then
   new.accumulated_hours:=old.accumulated_hours+new.initial_hours-old.initial_hours;
  end if;
 end if;
 return new;
end; $$;
create trigger equipment_guard before insert or update on public.equipment for each row execute function private.guard_equipment();

create function private.guard_work_item()
returns trigger language plpgsql set search_path='' as $$
declare tech boolean; supply boolean; head boolean; r public.repair_orders;
begin
 select * into strict r from public.repair_orders where id=new.repair_order_id for update;
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
 if new.dossier_status='closed' and (new.acceptance_status<>'accepted' or exists(
  select 1 from public.repair_material_usages u where u.repair_work_item_id=new.id
   and (u.document_status<>'documents_complete' or u.returned_quantity<u.borrowed_quantity)
 )) then raise exception using errcode='22023',message='Chưa nghiệm thu hoặc còn nợ vật tư/chứng từ'; end if;
 return new;
end; $$;
create trigger work_item_guard before insert or update on public.repair_work_items for each row execute function private.guard_work_item();

create function private.guard_material_usage()
returns trigger language plpgsql security definer set search_path='' as $$
declare item public.repair_work_items; r public.repair_orders; w uuid;
begin
 select * into strict item from public.repair_work_items where id=new.repair_work_item_id;
 select * into strict r from public.repair_orders where id=item.repair_order_id for update;
 select workspace_id into strict w from public.equipment where id=r.equipment_id;
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
  new.installed_at:=coalesce(case when tg_op='UPDATE' then old.installed_at end,now());
 else new.installed_at:=null; end if;
 if new.document_status='documents_complete' and (
  new.returned_quantity<new.borrowed_quantity or
  coalesce((select -sum(l.quantity_delta) from public.voucher_lines l where l.usage_id=new.id),0)<>new.quantity
 ) then raise exception using errcode='22023',message='Còn khoản vay hoặc chưa có phiếu lĩnh'; end if;
 return new;
end; $$;
create trigger material_usage_guard before insert or update on public.repair_material_usages for each row execute function private.guard_material_usage();

-- Every exposed table uses explicit grants and per-operation policies. No DELETE
-- policies for durable business records: void/archive or reversal preserves evidence.
do $$
declare t text;
begin
 foreach t in array array['workspaces','workspace_memberships','equipment','equipment_specs','repair_orders',
 'repair_work_items','materials','warehouses','repair_material_usages','vouchers','voucher_lines','equipment_downtimes'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end; $$;
create policy workspace_read on public.workspaces for select to authenticated using(
 private.has_role(id,enum_range(null::public.eam_role)));
create policy membership_read on public.workspace_memberships for select to authenticated using(
 user_id=auth.uid() or private.has_role(workspace_id,array['TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]));
create policy equipment_read on public.equipment for select to authenticated using(
 private.has_role(workspace_id,enum_range(null::public.eam_role)));
create policy equipment_create on public.equipment for insert to authenticated with check(
 private.has_role(workspace_id,array['TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]));
create policy equipment_update on public.equipment for update to authenticated using(
 private.has_role(workspace_id,array['TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[])) with check(
 private.has_role(workspace_id,array['TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]));
grant insert,update on public.equipment to authenticated;
create policy specs_read on public.equipment_specs for select to authenticated using(
 private.can_equipment(equipment_id,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]));
create policy specs_write on public.equipment_specs for all to authenticated using(
 private.can_equipment(equipment_id,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[])) with check(
 private.can_equipment(equipment_id,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]));
grant insert,update,delete on public.equipment_specs to authenticated;
create policy order_read on public.repair_orders for select to authenticated using(
 private.can_equipment(equipment_id,array['KY_THUAT_VIEN','CAN_BO_VAT_TU','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) or
 (created_by=auth.uid() and private.can_equipment(equipment_id,array['DOI_SAN_XUAT']::public.eam_role[])));
create policy order_create on public.repair_orders for insert to authenticated with check(
 private.can_equipment(equipment_id,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[])
 and created_by=auth.uid() and closed_at is null and cancelled_at is null);
create policy order_update on public.repair_orders for update to authenticated using(
 private.can_equipment(equipment_id,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[])) with check(
 private.can_equipment(equipment_id,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]));
grant insert,update on public.repair_orders to authenticated;
create policy item_read on public.repair_work_items for select to authenticated using(
 exists(select 1 from public.repair_orders r where r.id=repair_order_id));
create policy item_create on public.repair_work_items for insert to authenticated with check(
 private.can_order(repair_order_id,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]));
create policy item_update on public.repair_work_items for update to authenticated using(
 private.can_order(repair_order_id,array['KY_THUAT_VIEN','CAN_BO_VAT_TU','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[])) with check(
 private.can_order(repair_order_id,array['KY_THUAT_VIEN','CAN_BO_VAT_TU','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]));
grant insert,update on public.repair_work_items to authenticated;
do $$
declare t text;
begin
 foreach t in array array['materials','warehouses'] loop
  execute format('create policy catalogue_read on public.%I for select to authenticated using(private.has_role(workspace_id,enum_range(null::public.eam_role)))',t);
  execute format('create policy catalogue_insert on public.%I for insert to authenticated with check(private.has_role(workspace_id,array[''CAN_BO_VAT_TU'',''TRUONG_BO_PHAN_KY_THUAT'']::public.eam_role[]))',t);
  execute format('create policy catalogue_update on public.%I for update to authenticated using(private.has_role(workspace_id,array[''CAN_BO_VAT_TU'',''TRUONG_BO_PHAN_KY_THUAT'']::public.eam_role[])) with check(private.has_role(workspace_id,array[''CAN_BO_VAT_TU'',''TRUONG_BO_PHAN_KY_THUAT'']::public.eam_role[]))',t);
  execute format('grant insert,update on public.%I to authenticated',t);
 end loop;
end; $$;
create policy usage_read on public.repair_material_usages for select to authenticated using(
 exists(select 1 from public.repair_work_items i where i.id=repair_work_item_id));
create policy usage_create on public.repair_material_usages for insert to authenticated with check(
 private.can_item(repair_work_item_id,array['CAN_BO_VAT_TU','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]));
create policy usage_update on public.repair_material_usages for update to authenticated using(
 private.can_item(repair_work_item_id,array['CAN_BO_VAT_TU','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[])) with check(
 private.can_item(repair_work_item_id,array['CAN_BO_VAT_TU','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]));
grant insert,update on public.repair_material_usages to authenticated;
create policy voucher_read on public.vouchers for select to authenticated using(
 exists(select 1 from public.warehouses w where w.id=warehouse_id and private.has_role(w.workspace_id,
 array['KY_THUAT_VIEN','CAN_BO_VAT_TU','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[])));
create policy voucher_line_read on public.voucher_lines for select to authenticated using(
 exists(select 1 from public.vouchers v where v.id=voucher_id));
create policy downtime_read on public.equipment_downtimes for select to authenticated using(
 private.can_equipment(equipment_id,enum_range(null::public.eam_role)));
create policy downtime_insert on public.equipment_downtimes for insert to authenticated with check(
 private.can_equipment(equipment_id,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]));
create policy downtime_update on public.equipment_downtimes for update to authenticated using(
 private.can_equipment(equipment_id,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[])) with check(
 private.can_equipment(equipment_id,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]));
grant insert,update on public.equipment_downtimes to authenticated;
revoke execute on all functions in schema private from public,anon,authenticated;
grant execute on function private.has_role(uuid,public.eam_role[]),private.can_equipment(uuid,public.eam_role[]),
 private.can_order(uuid,public.eam_role[]),private.can_item(uuid,public.eam_role[]) to authenticated;
alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from public,anon,authenticated;
commit;
