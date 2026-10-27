-- Container reporting workflow, anomaly acknowledgement and role boundaries.
insert into auth.users(id) values('10000000-0000-0000-0000-000000000006');
insert into public.workspace_memberships(workspace_id,user_id,role) values
 ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000006','QUAN_TRI_HE_THONG');
insert into public.equipment(id,workspace_id,code,name,category) values
 ('20000000-0000-0000-0000-000000000099','00000000-0000-0000-0000-000000000001','AUX99','Ngoài phạm vi','AUXILIARY');

set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
select test.ok(not exists(select 1 from public.monthly_production where status<>'summarized'),'historical rows default to summarized status');
select public.save_container_report_month('00000000-0000-0000-0000-000000000001',null,null,'20000000-0000-0000-0000-000000000003','2027-01-01',100,'','summarized',false,'a1000000-0000-0000-0000-000000000001');
select public.save_container_report_month('00000000-0000-0000-0000-000000000001',null,null,'20000000-0000-0000-0000-000000000003','2027-02-01',100,'','summarized',false,'a1000000-0000-0000-0000-000000000002');
select public.save_container_report_month('00000000-0000-0000-0000-000000000001',null,null,'20000000-0000-0000-0000-000000000003','2027-03-01',100,'','summarized',false,'a1000000-0000-0000-0000-000000000003');
select test.fails($q$select public.save_container_report_month('00000000-0000-0000-0000-000000000001',null,null,'20000000-0000-0000-0000-000000000003','2027-04-01',300,'','summarized',false,'a1000000-0000-0000-0000-000000000004')$q$,'P0001','change above fifty percent requires acknowledgement');
select public.save_container_report_month('00000000-0000-0000-0000-000000000001',null,null,'20000000-0000-0000-0000-000000000003','2027-04-01',300,'Đã đối chiếu','summarized',true,'a1000000-0000-0000-0000-000000000005');
select test.ok((select anomaly_kind='change_over_50_pct' and anomaly_acknowledged from public.vw_container_report_monthly where equipment_code='QC11' and month='2027-04-01'),'acknowledged anomaly remains visible for review');
select test.fails($q$select public.save_container_report_month('00000000-0000-0000-0000-000000000001',null,null,'20000000-0000-0000-0000-000000000003','2027-04-01',300,'','summarized',true,'a1000000-0000-0000-0000-000000000006')$q$,'23505','duplicate equipment and month is rejected');
select test.fails($q$select public.save_container_report_month('00000000-0000-0000-0000-000000000001',null,null,'20000000-0000-0000-0000-000000000099','2027-01-01',1,'','summarized',false,'a1000000-0000-0000-0000-000000000007')$q$,'22023','non TK QC RTG equipment is rejected');

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
select public.set_container_report_status((select id from public.monthly_production where equipment_id='20000000-0000-0000-0000-000000000003' and month='2027-04-01'),(select version_no from public.monthly_production where equipment_id='20000000-0000-0000-0000-000000000003' and month='2027-04-01'),'checked');
select public.set_container_report_status((select id from public.monthly_production where equipment_id='20000000-0000-0000-0000-000000000003' and month='2027-04-01'),(select version_no from public.monthly_production where equipment_id='20000000-0000-0000-0000-000000000003' and month='2027-04-01'),'locked');
select test.ok((select status='locked' and checked_at is not null and locked_at is not null from public.monthly_production where equipment_id='20000000-0000-0000-0000-000000000003' and month='2027-04-01'),'manager checks then locks data');

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
select test.fails($q$select public.save_container_report_month('00000000-0000-0000-0000-000000000001',(select id from public.monthly_production where equipment_id='20000000-0000-0000-0000-000000000003' and month='2027-04-01'),(select version_no from public.monthly_production where equipment_id='20000000-0000-0000-0000-000000000003' and month='2027-04-01'),'20000000-0000-0000-0000-000000000003','2027-04-01',301,'','summarized',true,'a1000000-0000-0000-0000-000000000008')$q$,'42501','technician cannot edit locked data');

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000006',false);
select test.fails($q$select public.admin_reopen_container_report((select id from public.monthly_production where equipment_id='20000000-0000-0000-0000-000000000003' and month='2027-04-01'),(select version_no from public.monthly_production where equipment_id='20000000-0000-0000-0000-000000000003' and month='2027-04-01'),'x')$q$,'22023','admin reason is required');
select public.admin_reopen_container_report((select id from public.monthly_production where equipment_id='20000000-0000-0000-0000-000000000003' and month='2027-04-01'),(select version_no from public.monthly_production where equipment_id='20000000-0000-0000-0000-000000000003' and month='2027-04-01'),'Đối chiếu lại chứng từ');
select public.admin_cancel_container_report((select id from public.monthly_production where equipment_id='20000000-0000-0000-0000-000000000003' and month='2027-04-01'),(select version_no from public.monthly_production where equipment_id='20000000-0000-0000-0000-000000000003' and month='2027-04-01'),'Nhập nhầm kỳ báo cáo');
select test.ok((select cancelled_at is not null and cancel_reason='Nhập nhầm kỳ báo cáo' from public.monthly_production where equipment_id='20000000-0000-0000-0000-000000000003' and month='2027-04-01'),'admin cancel is soft and keeps reason');
select test.ok(exists(select 1 from public.audit_logs where table_name='monthly_production' and record_id=(select id from public.monthly_production where equipment_id='20000000-0000-0000-0000-000000000003' and month='2027-04-01') and operation='UPDATE'),'status and admin actions are audited');
reset role;
