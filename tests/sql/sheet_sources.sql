select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
set role authenticated;
insert into public.sheet_sources(id,workspace_id,name,spreadsheet_id) values
 ('d0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Fixture source','FAKE_SOURCE_ID_NOT_REAL_123456');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
select public.sync_container_source('d0000000-0000-0000-0000-000000000001',
 '[{"equipment_code":"QC11","month":"2026-09-01","boxes":1234,"teu":null}]','e0000000-0000-0000-0000-000000000001');
select public.sync_container_source('d0000000-0000-0000-0000-000000000001',
 '[{"equipment_code":"QC11","month":"2026-09-01","boxes":1234,"teu":null}]','e0000000-0000-0000-0000-000000000001');
select test.ok((select count(*)=1 from public.sheet_sync_runs),'Sheet retries create one accepted snapshot');
select test.ok((select boxes=1234 and teu=200 from public.monthly_production where equipment_id='20000000-0000-0000-0000-000000000003' and month='2026-09-01'),'Boxes-only update preserves separately measured TEU');
select public.sync_container_source('d0000000-0000-0000-0000-000000000001',
 '[{"equipment_code":"QC11","month":"2026-08-01","boxes":99,"teu":null}]','e0000000-0000-0000-0000-000000000002');
select test.ok((select teu is null from public.monthly_production where equipment_id='20000000-0000-0000-0000-000000000003' and month='2026-08-01'),'new Boxes-only month retains unknown TEU as NULL');
select test.ok((select cost_per_1000_teu_vnd is null and missing_container_months=1 from public.report_material_costs(
 '00000000-0000-0000-0000-000000000001','2026-08-01','2026-10-01') where equipment_code='QC11'),'partial TEU period cannot yield misleading cost ratio');
select test.fails($q$select public.sync_container_source('d0000000-0000-0000-0000-000000000001',
 (select jsonb_agg(jsonb_build_object('equipment_code','QC11','month',to_char(date '2000-01-01'+g*interval '1 month','YYYY-MM-DD'),'boxes',1,'teu',null)) from generate_series(0,999)g)
 || '[{"equipment_code":"UNKNOWN","month":"2026-09-01","boxes":1,"teu":null}]'::jsonb,
 'e0000000-0000-0000-0000-000000000003')$q$,'22023','bad row in second chunk rolls back entire multi-chunk Sheet sync');
select test.ok(not exists(select 1 from public.monthly_production where month='2000-01-01'),'no partial commit of first import chunk');
select test.fails('delete from public.sheet_sync_runs','42501','accepted source snapshots cannot be deleted by clients');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000005',false);
select test.ok((select count(*)=0 from public.sheet_sync_runs),'source snapshots stay inside workspace RLS');
reset role;
