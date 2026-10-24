set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',false);
insert into public.contractor_materials(workspace_id,equipment_id,material_name,unit,quantity,contractor_name,signed_on,warranty_months,request_key)
values('00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Vòng bi 6213','vòng',1,'Nhà thầu A','2025-12-10',12,'94000000-0000-0000-0000-000000000001');
select test.ok((select warranty_ends_on='2026-12-10' and quality_status='pending' from public.contractor_materials where request_key='94000000-0000-0000-0000-000000000001'),'contractor material calculates warranty end and starts pending');
update public.contractor_materials set quality_status='accepted',quality_checked_on='2026-10-24',quality_note='Đạt yêu cầu' where request_key='94000000-0000-0000-0000-000000000001';
select test.ok((select quality_status='accepted' and updated_by='10000000-0000-0000-0000-000000000003' from public.contractor_materials where request_key='94000000-0000-0000-0000-000000000001'),'supply role records quality result');
select test.fails($q$update public.contractor_materials set material_name='Đổi tên sau khi lưu' where request_key='94000000-0000-0000-0000-000000000001'$q$,'42501','identity and warranty facts stay immutable');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',false);
select test.ok(not exists(select 1 from public.contractor_materials),'production role cannot read contractor material records');
select test.fails($q$insert into public.contractor_materials(workspace_id,equipment_id,material_name,unit,quantity,signed_on,request_key) values('00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Không được phép','cái',1,'2026-10-24','94000000-0000-0000-0000-000000000002')$q$,'42501','production role cannot create contractor material records');
reset role;

