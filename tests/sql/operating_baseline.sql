-- Disposable fixture; all rows rolled back. Never infer zero for an unknown meter.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select test.ok(public.save_equipment_catalog('00000000-0000-0000-0000-000000000001',null,null,'71000000-0000-0000-0000-000000000001',
 'TEST_PENDING','Thiết bị thử','QC','available',null,null,'',array[]::text[])='71000000-0000-0000-0000-000000000001','catalog requires no baseline');
select test.ok((select initial_hours is null and accumulated_hours is null and hours_start_month is null from public.equipment where code='TEST_PENDING'),'unknown baseline and cumulative meter remain NULL');
select test.ok(public.save_equipment_catalog('00000000-0000-0000-0000-000000000001',null,null,'71000000-0000-0000-0000-000000000001',
 'TEST_PENDING','Thiết bị thử','QC','available',null,null,'',array[]::text[])='71000000-0000-0000-0000-000000000001','catalog retry with unknown baseline is safe');
select test.fails($q$insert into public.equipment_life_items(equipment_id,slot_code,name,component_kind,installed_at,installed_meter_hours,limit_hours)
 values('71000000-0000-0000-0000-000000000001','TEST','Cáp thử','CABLE',now(),0,100)$q$,'22023','unknown meter cannot produce a component life reading');
select test.ok(public.import_operating_months('00000000-0000-0000-0000-000000000001','[{"equipment_code":"TEST_PENDING","month":"2026-09-01","operating_hours":100}]',
 '71000000-0000-0000-0000-000000000010')=1,'monthly actual hours can be collected before baseline');
select test.ok((select accumulated_hours is null from public.equipment where code='TEST_PENDING'),'monthly data never invents cumulative zero');
select test.ok((select operating_hours=100 from public.report_operating_hours('71000000-0000-0000-0000-000000000001','2026-09-01','2026-09-01')),'period report uses actual monthly hours independently of meter baseline');
select test.fails($q$select public.confirm_operating_baseline('71000000-0000-0000-0000-000000000001',null,'2026-09-01',gen_random_uuid())$q$,'22023','blank baseline is rejected');
select test.fails($q$select public.confirm_operating_baseline('71000000-0000-0000-0000-000000000001',10.123,'2026-09-01',gen_random_uuid())$q$,'22023','baseline scale validated');
select test.fails($q$select public.confirm_operating_baseline('71000000-0000-0000-0000-000000000001',10,'2026-09-02',gen_random_uuid())$q$,'22023','first-month day must be one');
select test.fails($q$select public.confirm_operating_baseline('71000000-0000-0000-0000-000000000001',10,'2026-10-01',gen_random_uuid())$q$,'22023','cannot omit an already collected month from baseline window');
select test.ok((select initial_hours is null and accumulated_hours is null from public.equipment where code='TEST_PENDING'),'failed confirmation leaves unknown baseline unchanged');
select test.ok(public.confirm_operating_baseline('71000000-0000-0000-0000-000000000001',10,'2026-09-01','71000000-0000-0000-0000-000000000011')='71000000-0000-0000-0000-000000000001','leader confirms baseline and first month');
select test.ok((select initial_hours=10 and accumulated_hours=110 and hours_start_month='2026-09-01' and hours_confirmed_by=auth.uid() and hours_confirmed_at is not null
 from public.equipment where code='TEST_PENDING'),'confirmation adds baseline to existing actual hours once and records actor');
select test.ok(public.confirm_operating_baseline('71000000-0000-0000-0000-000000000001',10,'2026-09-01','71000000-0000-0000-0000-000000000011')='71000000-0000-0000-0000-000000000001','lost confirmation response retry is idempotent');
select test.ok((select accumulated_hours=110 from public.equipment where code='TEST_PENDING'),'retry never adds baseline twice');
select test.fails($q$select public.confirm_operating_baseline('71000000-0000-0000-0000-000000000001',11,'2026-09-01','71000000-0000-0000-0000-000000000011')$q$,'40001','confirmation retry cannot change payload');
select test.fails($q$select public.confirm_operating_baseline('71000000-0000-0000-0000-000000000001',10,'2026-09-01',gen_random_uuid())$q$,'40001','second confirmation cannot replace first');
select test.ok(public.import_operating_months('00000000-0000-0000-0000-000000000001','[{"equipment_code":"TEST_PENDING","month":"2026-09-01","operating_hours":90}]',
 '71000000-0000-0000-0000-000000000012')=1,'monthly correction still works after baseline');
select test.ok((select accumulated_hours=100 from public.equipment where code='TEST_PENDING'),'correction applies delta not total');
select test.fails($q$select public.import_operating_months('00000000-0000-0000-0000-000000000001','[{"equipment_code":"TEST_PENDING","month":"2026-10-01","operating_hours":30},{"equipment_code":"TEST_PENDING","month":"2026-08-01","operating_hours":10}]',
 '71000000-0000-0000-0000-000000000013')$q$,'22023','batch including pre-baseline month fails atomically');
select test.ok((select accumulated_hours=100 from public.equipment where code='TEST_PENDING') and not exists(select 1 from public.monthly_operating_hours where equipment_id='71000000-0000-0000-0000-000000000001' and month='2026-10-01'),'failed batch preserves rows and cumulative meter');
select test.fails($q$update public.equipment set initial_hours=0 where code='TEST_PENDING'$q$,'22023','direct catalog update cannot reset confirmed baseline');
select test.ok(public.save_equipment_catalog('00000000-0000-0000-0000-000000000001',null,null,'71000000-0000-0000-0000-000000000001',
 'TEST_PENDING','Thiết bị thử','QC','available',null,null,'',array[]::text[])='71000000-0000-0000-0000-000000000001','creation retry after hours confirmation never resets meter');
select test.ok(public.save_equipment_catalog('00000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001',2,gen_random_uuid(),
 'TEST_PENDING','Đổi tên','QC','available',null,null,'',array[]::text[])='71000000-0000-0000-0000-000000000001','catalog edits stay independent of hours');
select test.ok((select initial_hours=10 and accumulated_hours=100 and hours_start_month='2026-09-01' from public.equipment where code='TEST_PENDING'),'catalog edit preserves complete baseline and actual meter');
select public.save_equipment_catalog('00000000-0000-0000-0000-000000000001',null,null,'71000000-0000-0000-0000-000000000002',
 'TEST_ZERO','Thiết bị thử 0','QC','available',null,null,'',array[]::text[]);
select test.ok(public.confirm_operating_baseline('71000000-0000-0000-0000-000000000002',0,'2026-09-01','71000000-0000-0000-0000-000000000014')='71000000-0000-0000-0000-000000000002','explicit confirmed zero is allowed');
select test.ok((select initial_hours=0 and accumulated_hours=0 from public.equipment where code='TEST_ZERO'),'known zero differs from NULL');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select test.fails($q$select public.confirm_operating_baseline('71000000-0000-0000-0000-000000000001',10,'2026-09-01',gen_random_uuid())$q$,'42501','technician cannot confirm baseline');
select test.fails($q$select public.save_equipment_catalog('00000000-0000-0000-0000-000000000001',null,null,gen_random_uuid(),'TEST_DENIED','Thử','QC','available',null,null,'',array[]::text[])$q$,'42501','technician cannot use separate catalog API');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000005',true);
select test.fails($q$select public.confirm_operating_baseline('71000000-0000-0000-0000-000000000001',10,'2026-09-01',gen_random_uuid())$q$,'42501','other workspace leader cannot confirm');
set local role anon;
select test.fails($q$select public.confirm_operating_baseline('71000000-0000-0000-0000-000000000001',10,'2026-09-01',gen_random_uuid())$q$,'42501','anonymous cannot confirm');
select test.fails($q$select public.save_equipment_catalog('00000000-0000-0000-0000-000000000001',null,null,gen_random_uuid(),'TEST_ANON','Thử','QC','available',null,null,'',array[]::text[])$q$,'42501','anonymous cannot write separate catalog');
reset role;
select test.ok((select not prosecdef from pg_proc where oid='public.confirm_operating_baseline(uuid,numeric,date,uuid)'::regprocedure),'baseline API preserves RLS');
select test.ok((select not prosecdef from pg_proc where oid='public.save_equipment_catalog(uuid,uuid,integer,uuid,text,text,text,text,text,integer,text,text[])'::regprocedure),'separate catalog API preserves RLS');
rollback;
