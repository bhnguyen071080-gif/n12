-- Upgrade/active-contract tests after migration 006. Earlier fixtures deliberately
-- contain legacy TEU to prove the upgrade preserves, but never uses, existing data.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
select public.import_container_months('00000000-0000-0000-0000-000000000001',
 '[{"equipment_code":"QC11","month":"2026-09-01","boxes":3382}]','f0000000-0000-0000-0000-000000000001');
select test.ok((select boxes=3382 and teu=200 from public.monthly_production where equipment_id='20000000-0000-0000-0000-000000000003' and month='2026-09-01'),'count-only update preserves dormant historical data');
select test.ok((select accumulated_hours=1080 from public.equipment where code='QC11'),'container count never modifies monthly/cumulative operating hours');
select public.import_container_months('00000000-0000-0000-0000-000000000001',
 '[{"equipment_code":"QC11","month":"2026-09-01","boxes":3382}]','f0000000-0000-0000-0000-000000000001');
select test.ok((select count(*)=1 from public.monthly_production where equipment_id='20000000-0000-0000-0000-000000000003' and month='2026-09-01'),'retry has one equipment-month count row');
select test.fails($q$select public.import_container_months('00000000-0000-0000-0000-000000000001',
 '[{"equipment_code":"QC11","month":"2026-09-01","boxes":3382,"teu":null}]','f0000000-0000-0000-0000-000000000002')$q$,'22023','count API rejects even an empty legacy unit field');
select test.fails($q$select public.import_container_months('00000000-0000-0000-0000-000000000001',
 '[{"equipment_code":"QC11","month":"2026-09-01","boxes":1.5}]','f0000000-0000-0000-0000-000000000003')$q$,'22023','database rejects fractional counts rather than rounding them');
select test.fails($q$update public.monthly_production set teu=999 where equipment_id='20000000-0000-0000-0000-000000000003' and month='2026-09-01'$q$,'22023','direct table write cannot change dormant unit field');
select test.fails($q$insert into public.monthly_production(equipment_id,month,boxes,teu) values('20000000-0000-0000-0000-000000000003','2026-11-01',10,20)$q$,'22023','direct insert cannot record converted unit');
select public.import_container_months('00000000-0000-0000-0000-000000000001',
 '[{"equipment_code":"QC11","month":"2026-11-01","boxes":0}]','f0000000-0000-0000-0000-000000000004');
select test.ok((select boxes=0 and teu is null from public.monthly_production where equipment_id='20000000-0000-0000-0000-000000000003' and month='2026-11-01'),'new count row never calculates converted quantity, zero is explicit');
select test.ok((select container_boxes=3382 and known_cost_vnd=1200 from public.report_material_costs('00000000-0000-0000-0000-000000000001','2026-09-01','2026-10-01') where equipment_code='QC11'),'report returns raw container counts and total material costs');
select test.ok((select not (to_jsonb(r) ? 'container_teu') and not (to_jsonb(r) ? 'cost_per_1000_teu_vnd')
 from public.report_material_costs('00000000-0000-0000-0000-000000000001','2026-09-01','2026-10-01') r where equipment_code='QC11'),'active report returns neither converted quantity nor converted ratio');
select test.ok((select boxes=3382 and not (to_jsonb(r) ? 'teu') from public.vw_monthly_activity r where equipment_code='QC11' and month='2026-09-01'),'monthly activity view only exposes container counts');
select test.fails($q$select * from public.vw_monthly_metrics$q$,'42501','old converted-unit view no longer exposed to app users');
select test.fails($q$select public.import_monthly_metrics('00000000-0000-0000-0000-000000000001','[]','f0000000-0000-0000-0000-000000000005')$q$,'42501','old combined importer is retired');

select public.sync_container_source('d0000000-0000-0000-0000-000000000001',
 '[{"equipment_code":"QC11","month":"2026-09-01","boxes":3382}]','f0000000-0000-0000-0000-000000000006');
select test.ok((select accepted_rows='[{"equipment_code":"QC11","month":"2026-09-01","boxes":3382}]'::jsonb
 from public.sheet_sync_runs where request_key='f0000000-0000-0000-0000-000000000006'),'new source snapshot has counts only, no placeholder unit');
select test.fails($q$select public.sync_container_source('d0000000-0000-0000-0000-000000000001',
 '[{"equipment_code":"QC11","month":"2026-09-01","boxes":3382,"teu":null}]','f0000000-0000-0000-0000-000000000007')$q$,'22023','Sheets RPC also rejects legacy unit input');
select test.fails($q$select public.import_container_months('00000000-0000-0000-0000-000000000002',
 '[{"equipment_code":"QC11","month":"2026-09-01","boxes":3382}]','f0000000-0000-0000-0000-000000000008')$q$,'42501','count-only imports still enforce workspace authorization');
reset role;
select test.ok(not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' and not c.relrowsecurity),'all business tables still enforce RLS after upgrade');
