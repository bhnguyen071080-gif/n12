-- Test fixtures only. Phase 2 regression ran before this file.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
insert into public.equipment(id,workspace_id,code,name,category,initial_hours) values
 ('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','QC11','Phase 3 fixture','QC',1000),
 ('20000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','QC12','No hours fixture','QC',0);
insert into public.cargo_types(id,workspace_id,code,name,unit) values
 ('80000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','BULK','Bulk fixture','TONNE'),
 ('80000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','OTHER','Other workspace','M3');
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
select public.import_operating_months('00000000-0000-0000-0000-000000000001',
 '[{"equipment_code":"QC11","month":"2026-09-01","operating_hours":100}]','90000000-0000-0000-0000-000000000001');
select test.ok(not exists(select 1 from public.monthly_production where equipment_id='20000000-0000-0000-0000-000000000003'),'hours-only import creates no container row');
select public.import_container_months('00000000-0000-0000-0000-000000000001',
 '[{"equipment_code":"QC11","month":"2026-09-01","boxes":100,"teu":200}]','90000000-0000-0000-0000-000000000002');
select public.import_other_cargo_months('00000000-0000-0000-0000-000000000001',
 '[{"equipment_code":"QC11","month":"2026-09-01","cargo_code":"BULK","quantity":123.123}]','90000000-0000-0000-0000-000000000003');
select test.ok((select accumulated_hours=1100 from public.equipment where code='QC11'),'cargo imports never alter machine hours');
select test.ok((select quantity=123.123 and unit='TONNE' from public.vw_other_cargo_monthly where equipment_code='QC11'),'other cargo retains separate quantity and unit');
select test.fails($q$insert into public.monthly_other_cargo(equipment_id,cargo_type_id,month,quantity) values(
 '20000000-0000-0000-0000-000000000003','80000000-0000-0000-0000-000000000002','2026-09-01',1)$q$,'22023','cross-workspace cargo type denied');
insert into public.equipment_life_items(equipment_id,slot_code,name,component_kind,installed_at,installed_meter_hours,limit_hours)
 values('20000000-0000-0000-0000-000000000003','HOIST_1','Cable fixture','CABLE','2026-08-01 00:00+07',1000,120);
select test.ok((select used_hours=100 and remaining_hours=20 and alert_level='due_soon' from public.vw_component_life where equipment_code='QC11'),'monthly runtime drives cable life alert');

with c as(select public.create_work_case('20000000-0000-0000-0000-000000000003','repair','2026-09-10 08:00+07',null,'Fault A','a0000000-0000-0000-0000-000000000001') as id)
 insert into test.results select 'p3_order_a',r.id from c join public.repair_orders r on r.case_id=c.id;
-- SQL statement snapshots do not see rows created by volatile functions in joins;
-- resolve in a separate command if the CTE produced no result.
insert into test.results(name,id)
 select 'p3_order_a',id from public.repair_orders where case_id in(select id from public.work_cases where request_key='a0000000-0000-0000-0000-000000000001')
 on conflict(name) do nothing;
select public.create_work_case('20000000-0000-0000-0000-000000000003','repair','2026-09-12 12:00+07',null,'Fault B','a0000000-0000-0000-0000-000000000002');
insert into test.results select 'p3_order_b',id from public.repair_orders where case_id in(select id from public.work_cases where request_key='a0000000-0000-0000-0000-000000000002');
insert into public.repair_work_items(repair_order_id,item_no,symptom)
 select id,2,'Second independent work item' from test.results where name='p3_order_a';
insert into public.failure_incidents(id,equipment_id,repair_order_id,occurred_at,restored_at,confirmed,primary_cause_group)
 values
 ('b0000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003',(select id from test.results where name='p3_order_a'),'2026-09-10 08:00+07','2026-09-10 10:00+07',true,'ELECTRICAL_PLC'),
 ('b0000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003',(select id from test.results where name='p3_order_b'),'2026-09-12 12:00+07','2026-09-12 15:00+07',true,'MECHANICAL_CABLE');
insert into public.equipment_downtimes(equipment_id,repair_order_id,started_at,ended_at,failure_incident_id,downtime_kind) values
 ('20000000-0000-0000-0000-000000000003',(select id from test.results where name='p3_order_a'),'2026-09-10 08:00+07','2026-09-10 10:00+07','b0000000-0000-0000-0000-000000000001','failure'),
 ('20000000-0000-0000-0000-000000000003',(select id from test.results where name='p3_order_b'),'2026-09-12 12:00+07','2026-09-12 14:00+07','b0000000-0000-0000-0000-000000000002','failure'),
 ('20000000-0000-0000-0000-000000000003',(select id from test.results where name='p3_order_b'),'2026-09-12 13:00+07','2026-09-12 15:00+07','b0000000-0000-0000-0000-000000000002','failure');
select test.ok((select runtime_hours=100 and failure_downtime_hours=5 and failure_count=2 and mttr_hours=2.5 and mtbf_hours=50
 and abs(availability_pct-95.238095)<0.00001 from public.report_reliability('00000000-0000-0000-0000-000000000001','2026-09-01','2026-10-01')
 where equipment_code='QC11'),'KPIs use actual runtime, merge overlap and count incidents not items');
select test.ok((select mtbf_hours is null and availability_pct is null and missing_hour_months=1
 from public.report_reliability('00000000-0000-0000-0000-000000000001','2026-09-01','2026-10-01') where equipment_code='QC12'),'missing hours never masquerade as zero or full availability');
select test.ok((select incident_count=1 and percentage=50 from public.report_failure_causes('00000000-0000-0000-0000-000000000001','2026-09-01','2026-10-01')
 where cause='ELECTRICAL_PLC'),'cause distribution uses one primary cause per incident');

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',false);
with u as(insert into public.repair_material_usages(repair_work_item_id,material_id,quantity,document_status,installed_at,unit_cost_vnd)
 select id,'30000000-0000-0000-0000-000000000001',2,'installed','2026-09-10 10:00+07',500
 from public.repair_work_items where repair_order_id=(select id from test.results where name='p3_order_a') and item_no=1 returning id)
 insert into test.results select 'p3_usage',id from u;
insert into public.repair_material_usages(repair_work_item_id,material_id,quantity,document_status,installed_at)
 select id,'30000000-0000-0000-0000-000000000001',1,'installed','2026-09-12 15:00+07'
 from public.repair_work_items where repair_order_id=(select id from test.results where name='p3_order_b') and item_no=1;
select test.fails($q$update public.repair_work_items set root_cause_group='ENGINE_DRIVE' where repair_order_id=(select id from test.results where name='p3_order_a')$q$,
 '42501','supply cannot edit new cause taxonomy field');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
select test.ok((select known_cost_vnd=1000 and unpriced_usages=1 and cost_per_1000_teu_vnd is null
 from public.report_material_costs('00000000-0000-0000-0000-000000000001','2026-09-01','2026-10-01') where equipment_code='QC11'),'incomplete prices suppress misleading cost per TEU');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',false);
update public.repair_material_usages set unit_cost_vnd=200 where repair_work_item_id in(
 select id from public.repair_work_items where repair_order_id=(select id from test.results where name='p3_order_b'));
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
select test.ok((select known_cost_vnd=1200 and container_teu=200 and cost_per_1000_teu_vnd=6000
 from public.report_material_costs('00000000-0000-0000-0000-000000000001','2026-09-01','2026-10-01') where equipment_code='QC11'),'cost uses installation snapshots and only container TEU');
select public.import_operating_months('00000000-0000-0000-0000-000000000001',
 '[{"equipment_code":"QC11","month":"2026-09-01","operating_hours":80}]','90000000-0000-0000-0000-000000000004');
select test.ok((select used_hours=80 and remaining_hours=40 and alert_level='normal' from public.vw_component_life where equipment_code='QC11'),'corrected monthly runtime updates life alerts by delta');
select test.ok((select teu=200 from public.monthly_production where equipment_id='20000000-0000-0000-0000-000000000003'),'hours correction leaves container production untouched');
select test.ok(exists(select 1 from public.vw_technical_backlog where equipment_code='QC11'),'technical backlog reports unfinished items');

-- Mobile atomic save and idempotent conversion.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',false);
insert into test.results values('p3_inspect',public.submit_quick_inspection(
 '20000000-0000-0000-0000-000000000003','2026-10-09 07:00+07','Noise during shift',true,'c0000000-0000-0000-0000-000000000001'));
select test.ok(public.submit_quick_inspection(
 '20000000-0000-0000-0000-000000000003','2026-10-09 07:00+07','Noise during shift',true,'c0000000-0000-0000-0000-000000000001')
 =(select id from test.results where name='p3_inspect'),'quick inspection atomic retry returns same submitted case');
select test.ok((select submitted_at is not null from public.work_cases where id=(select id from test.results where name='p3_inspect')),'quick inspection submits checklist and case atomically');
select test.ok((select count(*)=0 from public.vw_component_life),'production role cannot read component-life technical records');
reset role;
select test.ok(not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity),'Phase 3 new tables have RLS');
