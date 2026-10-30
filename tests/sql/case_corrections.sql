-- Runs after personal_followup.sql in the disposable CI database.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
select public.save_tracking_case_summary((select id from test.results where name='personal_case'),'Synthetic repair','Synthetic repair corrected');
select test.ok((select c.summary='Synthetic repair corrected' and r.title='Synthetic repair corrected' from public.work_cases c join public.repair_orders r on r.case_id=c.id where c.id=(select id from test.results where name='personal_case')),'case summary correction updates case and order together');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
select test.fails($q$select public.cancel_tracking_case((select id from test.results where name='personal_case'),'Technician cannot cancel')$q$,'42501','technician cannot cancel a case');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
select public.cancel_tracking_case((select id from test.results where name='personal_case'),'Synthetic duplicate entered by mistake');
select test.ok((select cancelled_at is not null and cancel_reason='Synthetic duplicate entered by mistake' and cancelled_by='10000000-0000-0000-0000-000000000001' from public.repair_orders where case_id=(select id from test.results where name='personal_case')),'head cancels with actor and mandatory reason');
select test.fails($q$select public.save_tracking_case_summary((select id from test.results where name='personal_case'),'Synthetic repair corrected','Must not change')$q$,'22023','cancelled case cannot be edited');
select test.ok(not exists(select 1 from public.vw_case_followup_backlog where case_id=(select id from test.results where name='personal_case')),'cancelled case leaves active backlog');
reset role;
select test.ok(exists(select 1 from public.audit_logs where table_name='repair_orders' and new_data->>'cancel_reason'='Synthetic duplicate entered by mistake'),'cancellation remains in audit log');

