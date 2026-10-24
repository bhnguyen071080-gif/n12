begin;

create index contractor_materials_created_by_idx on public.contractor_materials(created_by);
create index contractor_materials_updated_by_idx on public.contractor_materials(updated_by);

alter policy contractor_material_create on public.contractor_materials with check(
 created_by=(select auth.uid()) and updated_by=(select auth.uid()) and
 private.has_role(workspace_id,array['CAN_BO_VAT_TU','KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[])
);

commit;

