begin;

drop policy contractor_material_update on public.contractor_materials;
revoke update on public.contractor_materials from authenticated;

alter table public.contractor_materials
 drop column quality_status,
 drop column quality_checked_on,
 drop column quality_note;

create or replace function private.guard_contractor_material() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' then
  raise exception using errcode='42501',message='Dòng vật tư đã lắp không được sửa trực tiếp';
 end if;
 if not exists(select 1 from public.equipment e where e.id=new.equipment_id and e.workspace_id=new.workspace_id) then
  raise exception using errcode='22023',message='Phương tiện không thuộc workspace';
 end if;
 if new.created_by is distinct from auth.uid() or new.updated_by is distinct from auth.uid() then
  raise exception using errcode='42501',message='Sai người tạo';
 end if;
 return new;
end;$$;

commit;

