-- Runs after personal_followup.sql in the disposable CI database.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',false);
insert into public.material_limit_versions(workspace_id,material_id,effective_from,limit_hours,warning_hours,source_document,request_key)
values('00000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000001','2026-02-01',150,20,'Synthetic Port standard','f1000000-0000-0000-0000-000000000001');
select test.ok((select limit_hours=150 and alert_level='overdue' from public.report_material_hours('e0000000-0000-0000-0000-000000000001','2026-03-01') where material_code='TEST_CABLE'),'dated standard overrides legacy material limit for the report month');
select test.fails($q$update public.material_limit_versions set limit_hours=200 where request_key='f1000000-0000-0000-0000-000000000001'$q$,'42501','issued standard version cannot be overwritten');
select test.fails($q$delete from public.material_limit_versions where request_key='f1000000-0000-0000-0000-000000000001'$q$,'42501','issued standard version cannot be deleted');
reset role;

