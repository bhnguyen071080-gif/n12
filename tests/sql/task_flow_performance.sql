-- Focused online read paths must preserve results while enforcing workspace scope.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
set role authenticated;

select test.ok(exists(
 select 1 from public.read_monthly_activity(
  '00000000-0000-0000-0000-000000000001','2026-09-01','2026-09-01',null,0,100
 ) where equipment_code='QC11' and boxes=3382
),'scoped monthly RPC preserves the active container result');

select test.ok(exists(
 select 1 from public.read_equipment_history(
  '00000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000001',
  '2026-01-01','2026-12-31',null,null,1000
 ) where work_items->0->>'performed_on' is not null
),'task history RPC returns actual work dates without loading material subtrees');

select test.ok((
 select count(*)<=1 from public.read_monthly_activity(
  '00000000-0000-0000-0000-000000000001',null,null,'QC',0,1
 )
),'monthly RPC enforces its server-side page size');

reset role;
update public.materials set service_limit_hours=250,service_warning_hours=50 where code='TEST_CABLE';
set role authenticated;
select test.ok(exists(
 select 1 from public.report_workspace_material_alerts(
  '00000000-0000-0000-0000-000000000001','2026-03-01',12
 ) where material_code='TEST_CABLE' and alert_level in('due_soon','overdue')
),'dashboard alert RPC returns only actionable yellow or red rows');

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000005',false);
select test.fails($q$select * from public.read_monthly_activity(
 '00000000-0000-0000-0000-000000000001',null,null,null,0,10
)$q$,'42501','monthly RPC blocks another workspace');
select test.fails($q$select * from public.read_equipment_history(
 '00000000-0000-0000-0000-000000000001',null,'2026-01-01','2026-12-31',null,null,10
)$q$,'42501','history RPC blocks another workspace');
select test.fails($q$select * from public.report_workspace_material_alerts(
 '00000000-0000-0000-0000-000000000001','2026-03-01',12
)$q$,'42501','alert RPC blocks another workspace');

reset role;
set role anon;
select test.fails($q$select * from public.read_monthly_activity(
 '00000000-0000-0000-0000-000000000001',null,null,null,0,10
)$q$,'42501','anonymous users cannot execute optimized read paths');
reset role;
