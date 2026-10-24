begin;
create table public.contractor_materials(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 equipment_id uuid not null references public.equipment(id),
 material_name text not null check(length(btrim(material_name)) between 1 and 300),
 unit text not null check(length(btrim(unit)) between 1 and 40),
 quantity numeric(18,3) not null check(quantity>0 and quantity<=1000000),
 contractor_name text not null default '' check(length(contractor_name)<=200),
 signed_on date not null,
 warranty_months integer not null default 0 check(warranty_months between 0 and 120),
 warranty_ends_on date generated always as ((signed_on+make_interval(months=>warranty_months))::date) stored,
 quality_status text not null default 'pending' check(quality_status in ('pending','accepted','conditional','rejected')),
 quality_checked_on date,
 quality_note text not null default '' check(length(quality_note)<=1000),
 notes text not null default '' check(length(notes)<=1000),
 request_key uuid not null unique,
 created_by uuid not null default auth.uid() references auth.users(id),
 updated_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check((quality_status='pending' and quality_checked_on is null) or (quality_status<>'pending' and quality_checked_on is not null))
);
create index contractor_materials_workspace_warranty_idx on public.contractor_materials(workspace_id,warranty_ends_on);
create index contractor_materials_equipment_idx on public.contractor_materials(equipment_id);

create function private.guard_contractor_material() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.equipment e where e.id=new.equipment_id and e.workspace_id=new.workspace_id) then
  raise exception using errcode='22023',message='Phương tiện không thuộc workspace';
 end if;
 if tg_op='INSERT' then
  if new.created_by is distinct from auth.uid() or new.updated_by is distinct from auth.uid() then raise exception using errcode='42501',message='Sai người tạo';end if;
 else
  if row(new.id,new.workspace_id,new.equipment_id,new.material_name,new.unit,new.quantity,new.contractor_name,new.signed_on,new.warranty_months,new.request_key,new.created_by,new.created_at)
   is distinct from row(old.id,old.workspace_id,old.equipment_id,old.material_name,old.unit,old.quantity,old.contractor_name,old.signed_on,old.warranty_months,old.request_key,old.created_by,old.created_at) then
   raise exception using errcode='42501',message='Chỉ được cập nhật kết quả kiểm tra chất lượng';
  end if;
  new.updated_by:=auth.uid();new.updated_at:=now();
 end if;
 return new;
end;$$;
revoke all on function private.guard_contractor_material() from public,anon,authenticated;
create trigger contractor_material_guard before insert or update on public.contractor_materials for each row execute function private.guard_contractor_material();

alter table public.contractor_materials enable row level security;
revoke all on public.contractor_materials from anon,authenticated;
grant select,insert,update on public.contractor_materials to authenticated;
create policy contractor_material_read on public.contractor_materials for select to authenticated using(
 private.has_role(workspace_id,enum_range(null::public.eam_role)));
create policy contractor_material_create on public.contractor_materials for insert to authenticated with check(
 created_by=auth.uid() and updated_by=auth.uid() and private.has_role(workspace_id,array['CAN_BO_VAT_TU','KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]));
create policy contractor_material_update on public.contractor_materials for update to authenticated using(
 private.has_role(workspace_id,array['CAN_BO_VAT_TU','KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[])) with check(
 private.has_role(workspace_id,array['CAN_BO_VAT_TU','KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]));
commit;

