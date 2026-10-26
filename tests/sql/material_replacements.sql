-- Runs after personal_followup.sql, which creates two installed TEST_CABLE rows.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
select test.ok((select count(*)=2 from public.report_material_replacements('00000000-0000-0000-0000-000000000001','2026-01-01','2026-04-30','e0000000-0000-0000-0000-000000000001','',500)),'history returns every installed replacement, not only the latest');
select test.ok((select previous_replaced_on='2026-01-15' and days_since_previous=64 and total_count=2 from public.report_material_replacements('00000000-0000-0000-0000-000000000001','2026-01-01','2026-04-30','e0000000-0000-0000-0000-000000000001','TEST_CABLE',500) where replaced_on='2026-03-20'),'history calculates the interval from the previous replacement');
select test.ok((select count(*)=1 from public.report_material_replacements('00000000-0000-0000-0000-000000000001','2026-03-01','2026-03-31',null,'Synthetic cable',500)),'date and free-text filters are applied in the database');
select test.fails($q$select * from public.report_material_replacements('00000000-0000-0000-0000-000000000001','2026-04-01','2026-03-01',null,'',500)$q$,'22023','reversed history range is rejected');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000005',false);
select test.fails($q$select * from public.report_material_replacements('00000000-0000-0000-0000-000000000001','2026-01-01','2026-04-30',null,'',500)$q$,'42501','another workspace cannot read replacement history');
reset role;

