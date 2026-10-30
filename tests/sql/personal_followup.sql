-- Disposable synthetic fixture; never execute against live Supabase.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
set role authenticated;
insert into public.equipment(id,workspace_id,code,name,category,initial_hours) values('e0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','TST01','Synthetic equipment','QC',99999);
insert into public.materials(id,workspace_id,code,name,unit,service_limit_hours) values
 ('e1000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','TEST_CABLE','Synthetic cable','bo',1000),
 ('e1000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','TEST_BOLT','Synthetic bolt','cai',null);
select public.import_operating_months('00000000-0000-0000-0000-000000000001',
 '[{"equipment_code":"TST01","month":"2026-01-01","operating_hours":100},{"equipment_code":"TST01","month":"2026-02-01","operating_hours":0},{"equipment_code":"TST01","month":"2026-03-01","operating_hours":200}]','e2000000-0000-0000-0000-000000000001');
insert into test.results values('personal_case',public.create_tracking_case('e0000000-0000-0000-0000-000000000001','repair','2026-01-10','Synthetic repair','e3000000-0000-0000-0000-000000000001'));
insert into test.results select 'personal_order',id from public.repair_orders where case_id=(select id from test.results where name='personal_case');
insert into test.results select 'personal_item',id from public.repair_work_items where repair_order_id=(select id from test.results where name='personal_order');
select test.ok((select split_part(code,'-',3)=to_char(created_at at time zone 'Asia/Bangkok','DDMMYYYY') and split_part(code,'-',4)=to_char(created_at at time zone 'Asia/Bangkok','HH24MI') and actual_started_at='2026-01-10 00:00+07' from public.work_cases where id=(select id from test.results where name='personal_case')),'code reflects entry time while actual day remains independent');
select test.ok(public.create_tracking_case('e0000000-0000-0000-0000-000000000001','repair','2026-01-10','Synthetic repair','e3000000-0000-0000-0000-000000000001')=(select id from test.results where name='personal_case'),'case retry creates no duplicate');
select test.ok((select count(*)=1 from public.case_material_followups where case_id=(select id from test.results where name='personal_case')),'exactly one common return state per case');

insert into test.results values('personal_usage',public.add_tracking_material((select id from test.results where name='personal_item'),'e1000000-0000-0000-0000-000000000001',1,'borrowed',false,'Position A','e4000000-0000-0000-0000-000000000001'));
select test.ok(public.add_tracking_material((select id from test.results where name='personal_item'),'e1000000-0000-0000-0000-000000000001',1,'borrowed',false,'Position A','e4000000-0000-0000-0000-000000000001')=(select id from test.results where name='personal_usage'),'material retry does not duplicate a line');
select test.ok((select installed_at is null from public.repair_material_usages where id=(select id from test.results where name='personal_usage')),'borrowed material is not automatically installed');
select test.ok((select count(*)=0 from public.report_material_hours('e0000000-0000-0000-0000-000000000001','2026-03-01')),'uninstalled material does not appear as latest replacement');
select public.set_material_return((select id from test.results where name='personal_case'),'completed','2026-02-01 09:00+07',(select version_no from public.case_material_followups where case_id=(select id from test.results where name='personal_case')),'Synthetic completion');
select test.ok((select return_status='completed' from public.case_material_followups where case_id=(select id from test.results where name='personal_case')),'return may finish before installation without any stock posting');
select public.add_tracking_material((select id from test.results where name='personal_item'),'e1000000-0000-0000-0000-000000000002',4,'issued',false,'','e4000000-0000-0000-0000-000000000002');
select test.ok((select return_status='pending' and completed_at is null from public.case_material_followups where case_id=(select id from test.results where name='personal_case')),'new material reopens the whole case return');
reset role;
select test.ok(exists(select 1 from public.audit_logs where table_name='case_material_followups' and old_data->>'case_id'=(select id::text from test.results where name='personal_case') and old_data->>'return_status'='completed' and old_data->>'completed_at' is not null and new_data->>'return_status'='pending'),'previous return time is preserved in audit');
set role authenticated;
select public.update_tracking_material((select id from test.results where name='personal_usage'),'issued',true);
select test.ok((select installed_at='2026-01-10 00:00+07' from public.repair_material_usages where id=(select id from test.results where name='personal_usage')),'installation date is actual item day, not entry/return time');
select public.save_tracking_item((select id from test.results where name='personal_order'),(select id from test.results where name='personal_item'),
 (select version_no from public.repair_work_items where id=(select id from test.results where name='personal_item')),
 '{"symptom":"Wear","root_cause":"Synthetic cause","solution_plan":"Replace","execution_result":"Done","performed_on":"2026-01-15","execution_status":"completed"}','e5000000-0000-0000-0000-000000000001');
select test.ok((select installed_at='2026-01-15 00:00+07' from public.repair_material_usages where id=(select id from test.results where name='personal_usage')),'corrected history day synchronizes installation without re-entry');
select test.ok((select work_items->0->>'performed_on'='2026-01-15' and work_items->0->'materials'->0->>'return_status'='pending' from public.vw_equipment_history where order_id=(select id from test.results where name='personal_order')),'automatic history includes actual day and common return state');
select test.fails($q$select public.save_tracking_item((select id from test.results where name='personal_order'),(select id from test.results where name='personal_item'),1,'{"symptom":"Stale"}',gen_random_uuid())$q$,'40001','stale technical overwrite is rejected');
select test.ok((select sum(operating_hours)=300 and count(*)=3 from public.report_operating_hours('e0000000-0000-0000-0000-000000000001','2026-01-01','2026-03-01')),'inclusive chain counts both ends without using lifetime baseline');
select test.ok((select operating_hours=0 from public.report_operating_hours('e0000000-0000-0000-0000-000000000001','2026-02-01','2026-02-01')),'single month and genuine zero are supported');
select test.ok((select count(*) filter(where operating_hours is null)=1 and sum(operating_hours)=300 from public.report_operating_hours('e0000000-0000-0000-0000-000000000001','2026-01-01','2026-04-01')),'missing month is explicit, not fabricated zero');
select test.fails($q$select public.report_operating_hours('e0000000-0000-0000-0000-000000000001','2026-03-01','2026-02-01')$q$,'22023','reversed range is rejected');
select test.ok((select recorded_hours=300 and remaining_hours=700 and from_month='2026-01-01' from public.report_material_hours('e0000000-0000-0000-0000-000000000001','2026-03-01') where material_code='TEST_CABLE'),'hours since replacement use whole months, not the meter');
select test.ok((select missing_months=1 and remaining_hours is null and alert_level='incomplete' from public.report_material_hours('e0000000-0000-0000-0000-000000000001','2026-04-01') where material_code='TEST_CABLE'),'missing data prevents false remaining life');
select test.ok((select status='available' from public.equipment where id='e0000000-0000-0000-0000-000000000001'),'a running machine stays available while owing return documents');
select test.ok(exists(select 1 from public.vw_case_followup_backlog where case_id=(select id from test.results where name='personal_case')),'return debt remains visible separately from machine status');

insert into test.results values('personal_case2',public.create_tracking_case('e0000000-0000-0000-0000-000000000001','maintenance','2026-03-20','Synthetic maintenance','e3000000-0000-0000-0000-000000000002'));
insert into test.results select 'personal_order2',id from public.repair_orders where case_id=(select id from test.results where name='personal_case2');
insert into test.results select 'personal_item2',id from public.repair_work_items where repair_order_id=(select id from test.results where name='personal_order2');
select public.add_tracking_material((select id from test.results where name='personal_item2'),'e1000000-0000-0000-0000-000000000001',1,'issued',true,'Position B','e4000000-0000-0000-0000-000000000003');
select test.ok((select performed_on='2026-03-20' and "position"='Position B' and recorded_hours=200 from public.report_material_hours('e0000000-0000-0000-0000-000000000001','2026-03-01') where material_code='TEST_CABLE'),'latest installation is chosen by actual work date with descriptive position');
select test.ok((select performed_on='2026-01-15' from public.report_material_hours('e0000000-0000-0000-0000-000000000001','2026-02-01') where material_code='TEST_CABLE'),'historical end month excludes later replacement');
select public.save_tracking_item((select id from test.results where name='personal_order2'),(select id from test.results where name='personal_item2'),
 (select version_no from public.repair_work_items where id=(select id from test.results where name='personal_item2')),
 '{"symptom":"PM","root_cause":"Scheduled","solution_plan":"Replace","execution_result":"Done","execution_status":"completed"}','e5000000-0000-0000-0000-000000000002');
select test.ok((select status='available' from public.equipment where id='e0000000-0000-0000-0000-000000000001'),'finished maintenance clears technical stop independently of return debt');

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
select test.fails($q$select public.save_tracking_item((select id from test.results where name='personal_order'),(select id from test.results where name='personal_item'),
 (select version_no from public.repair_work_items where id=(select id from test.results where name='personal_item')),'{"acceptance_status":"accepted"}',gen_random_uuid())$q$,'42501','technician cannot approve acceptance via definer RPC');
select public.add_tracking_material((select id from test.results where name='personal_item'),'e1000000-0000-0000-0000-000000000002',1,'borrowed',false,'','e4000000-0000-0000-0000-000000000004');
select test.ok((select count(*)=3 from public.repair_material_usages where repair_work_item_id=(select id from test.results where name='personal_item')),'technician can track several materials without posting stock');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',false);
select test.fails($q$update public.repair_work_items set performed_on='2026-01-16' where id=(select id from test.results where name='personal_item')$q$,'42501','supply cannot change actual technical date');
select public.set_material_return((select id from test.results where name='personal_case'),'completed','2026-03-01 10:00+07',
 (select version_no from public.case_material_followups where case_id=(select id from test.results where name='personal_case')),'Synthetic settled');
select test.ok(not exists(select 1 from public.vw_case_followup_backlog where case_id=(select id from test.results where name='personal_case')),'one common return completion clears all material debt');
select test.ok((select installed_at='2026-01-15 00:00+07' from public.repair_material_usages where id=(select id from test.results where name='personal_usage')),'return completion leaves replacement date unchanged');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',false);
select test.fails($q$select public.create_tracking_case('e0000000-0000-0000-0000-000000000001','repair','2026-01-01','Unauthorized',gen_random_uuid())$q$,'42501','operator cannot enter technical workflow');
insert into test.results values('personal_phone_order',public.report_equipment_fault('e0000000-0000-0000-0000-000000000001','2026-09-01 08:00+07','Synthetic phone report',false,'e6000000-0000-0000-0000-000000000001'));
reset role;
select test.ok((select c.tracking_only and i.performed_on='2026-09-01' from public.repair_orders r join public.work_cases c on c.id=r.case_id join public.repair_work_items i on i.repair_order_id=r.id where r.id=(select id from test.results where name='personal_phone_order')),'operator phone fault enters common tracking without technical edit privileges');
set role authenticated;
insert into test.results values('personal_check',public.create_work_case('e0000000-0000-0000-0000-000000000001','inspection','2026-09-02 08:00+07',null,'Synthetic check','e6000000-0000-0000-0000-000000000002'));
insert into public.case_checks(case_id,item_no,label,abnormal,notes) select id,1,'Synthetic abnormal',true,'Synthetic symptom' from test.results where name='personal_check';
update public.work_cases set submitted_at=now() where id=(select id from test.results where name='personal_check');
insert into test.results values('personal_converted',public.convert_inspection_to_repair((select id from test.results where name='personal_check')));
reset role;
select test.ok((select c.tracking_only and i.performed_on='2026-09-02' from public.repair_orders r join public.work_cases c on c.id=r.case_id join public.repair_work_items i on i.repair_order_id=r.id where r.id=(select id from test.results where name='personal_converted')),'operator conversion keeps real check day and links common material follow-up');
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000005',false);
select test.ok((select count(*)=0 from public.case_material_followups where case_id=(select id from test.results where name='personal_case')),'follow-up RLS isolates another workspace');
select test.fails($q$select public.set_material_return((select id from test.results where name='personal_case'),'completed',now(),1,'Other workspace')$q$,'42501','cross-workspace return write denied');
select test.fails($q$select public.report_operating_hours('e0000000-0000-0000-0000-000000000001','2026-01-01','2026-01-01')$q$,'42501','cross-workspace hour report denied');
reset role;
set role anon;
select test.fails($q$select * from public.case_material_followups$q$,'42501','anonymous cannot read common return status');
select test.fails($q$select public.create_tracking_case('e0000000-0000-0000-0000-000000000001','repair','2026-01-01','Anonymous',gen_random_uuid())$q$,'42501','anonymous cannot invoke follow-up writes');
reset role;
