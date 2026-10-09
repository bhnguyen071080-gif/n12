select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
set role authenticated;
insert into public.sheet_sources(id,workspace_id,name,spreadsheet_id,source_kind,start_month,a1_range) values
 ('d1000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Synthetic hours source','FAKE_HOURS_SOURCE_NOT_REAL_123456','hours','2026-01-01','A3:AR200');
select test.fails($q$update public.sheet_sources set source_kind='container',start_month=null where id='d1000000-0000-0000-0000-000000000001'$q$,'42501','source kind is immutable to preserve snapshot meaning');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
select public.sync_hours_source('d1000000-0000-0000-0000-000000000001',
 '[{"equipment_code":"QC11","month":"2026-09-01","operating_hours":90.25}]','f1000000-0000-0000-0000-000000000001');
select test.fails($q$select private.sync_monthly_source('d1000000-0000-0000-0000-000000000001',
 '[{"equipment_code":"QC11","month":"2026-09-01","operating_hours":1}]','f1000000-0000-0000-0000-000000000010',null)$q$,'22023','NULL source routing kind is rejected');
select test.ok((select accumulated_hours=1090.25 from public.equipment where code='QC11'),'Sheet hours update cumulative total by correction delta');
select test.ok((select boxes=3382 from public.monthly_production where equipment_id='20000000-0000-0000-0000-000000000003' and month='2026-09-01'),'hours Sheet never changes container count');
select test.ok((select used_hours=90.25 and remaining_hours=29.75 from public.vw_component_life where equipment_code='QC11'),'hours Sheet drives life-limit query from same cumulative meter');
select public.sync_hours_source('d1000000-0000-0000-0000-000000000001',
 '[{"equipment_code":"QC11","month":"2026-09-01","operating_hours":90.25}]','f1000000-0000-0000-0000-000000000001');
select test.ok((select count(*)=1 from public.sheet_sync_runs where source_id='d1000000-0000-0000-0000-000000000001'),'hours Sheet retry writes one immutable snapshot');
select test.ok((select accumulated_hours=1090.25 from public.equipment where code='QC11'),'hours Sheet retry never double-counts runtime');
select test.fails($q$select public.sync_hours_source('d1000000-0000-0000-0000-000000000001',
 '[{"equipment_code":"QC11","month":"2025-12-01","operating_hours":10}]','f1000000-0000-0000-0000-000000000002')$q$,'22023','source rejects months before declared start');
select test.fails($q$select public.sync_hours_source('d1000000-0000-0000-0000-000000000001',
 '[{"equipment_code":"QC11","month":"2026-09-01","operating_hours":90.251}]','f1000000-0000-0000-0000-000000000003')$q$,'22023','hours source rejects unsupported decimal precision');
select test.fails($q$select public.sync_container_source('d1000000-0000-0000-0000-000000000001',
 '[{"equipment_code":"QC11","month":"2026-09-01","boxes":1}]','f1000000-0000-0000-0000-000000000004')$q$,'22023','hours source cannot be routed to container importer');
select test.fails($q$select public.sync_hours_source('d0000000-0000-0000-0000-000000000001',
 '[{"equipment_code":"QC11","month":"2026-09-01","operating_hours":1}]','f1000000-0000-0000-0000-000000000005')$q$,'22023','container source cannot be routed to hours importer');
select test.fails($q$select public.sync_hours_source('d1000000-0000-0000-0000-000000000001',
 '[{"equipment_code":"QC11","month":"2026-09-01","operating_hours":15},{"equipment_code":"QC11","month":"2026-10-01","operating_hours":999}]','f1000000-0000-0000-0000-000000000006')$q$,'23514','impossible monthly runtime rolls back the entire hours source');
select test.ok((select operating_hours=90.25 from public.monthly_operating_hours where equipment_id='20000000-0000-0000-0000-000000000003' and month='2026-09-01'),'bad second row does not partially overwrite first monthly hours');
select test.fails($q$select public.sync_hours_source('d1000000-0000-0000-0000-000000000001',
 '[{"equipment_code":"QC11","month":"2026-09-01","operating_hours":20,"boxes":1}]','f1000000-0000-0000-0000-000000000007')$q$,'22023','hours source accepts no container fields');
select test.fails($q$select public.sync_hours_source('d1000000-0000-0000-0000-000000000001',
 (select jsonb_agg(jsonb_build_object('equipment_code',case when n%2=0 then 'QC11' else 'QC12' end,
 'month',to_char(date '2026-01-01'+make_interval(months=>(n/2)),'YYYY-MM-DD'),'operating_hours',1) order by n)
 from generate_series(0,999) n) || '[{"equipment_code":"UNKNOWN","month":"2026-01-01","operating_hours":1}]'::jsonb,
 'f1000000-0000-0000-0000-000000000009')$q$,'22023','invalid second chunk rolls back the entire hours-source import');
select test.ok((select accumulated_hours=1090.25 from public.equipment where code='QC11'),'multi-chunk failure leaves cumulative meter unchanged');
select test.ok(not exists(select 1 from public.audit_logs),'technician cannot read head-only audit log');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
select test.ok(exists(select 1 from public.audit_logs where table_name='monthly_operating_hours'
 and actor_id='10000000-0000-0000-0000-000000000002' and operation='UPDATE'
 and new_data->>'equipment_id'='20000000-0000-0000-0000-000000000003'
 and (old_data->>'operating_hours')::numeric=80 and (new_data->>'operating_hours')::numeric=90.25),'head verifies audited hours correction with actor and old/new values');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',false);
select test.fails($q$select public.sync_hours_source('d1000000-0000-0000-0000-000000000001',
 '[{"equipment_code":"QC11","month":"2026-09-01","operating_hours":20}]','f1000000-0000-0000-0000-000000000008')$q$,'42501','production role cannot import technical monthly hours');
reset role;
