-- Run after all migrations against the disposable fixture database.
create schema test;
grant usage on schema test to authenticated,anon;
create function test.ok(condition boolean,message text) returns void language plpgsql as $$
begin
 if condition is distinct from true then raise exception 'ASSERTION FAILED: %',message; end if;
 raise notice 'PASS: %',message;
end; $$;
create function test.fails(command text,expected_state text,message text) returns void language plpgsql as $$
declare rejected boolean:=false; caught_state text;
begin
 begin execute command;
 exception when others then
  get stacked diagnostics caught_state=returned_sqlstate;
  if caught_state<>expected_state then raise exception 'Unexpected SQLSTATE % for %',caught_state,message; end if;
  rejected:=true;
 end;
 perform test.ok(rejected,message);
end; $$;
grant execute on all functions in schema test to authenticated,anon;
create table test.results(name text primary key,id uuid);
grant select,insert,update on test.results to authenticated;

insert into auth.users(id) values
 ('10000000-0000-0000-0000-000000000001'),
 ('10000000-0000-0000-0000-000000000002'),
 ('10000000-0000-0000-0000-000000000003'),
 ('10000000-0000-0000-0000-000000000004'),
 ('10000000-0000-0000-0000-000000000005');
insert into public.workspaces(id,name) values
 ('00000000-0000-0000-0000-000000000001','Fixture A'),
 ('00000000-0000-0000-0000-000000000002','Fixture B');
insert into public.workspace_memberships(workspace_id,user_id,role) values
 ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','TRUONG_BO_PHAN_KY_THUAT'),
 ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','KY_THUAT_VIEN'),
 ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','CAN_BO_VAT_TU'),
 ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004','DOI_SAN_XUAT'),
 ('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000005','TRUONG_BO_PHAN_KY_THUAT');
insert into public.equipment(id,workspace_id,code,name,category,initial_hours) values
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','QC10','QC fixture','QC',100),
 ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','RTG22','RTG fixture','RTG',0);
insert into public.materials(id,workspace_id,code,name,unit) values
 ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','VT001','Fixture bearing','cai');
insert into public.warehouses(id,workspace_id,code,name) values
 ('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','K01','Fixture warehouse');

-- Operator: own case, immutable identifier, actual time is separate.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',false);
select test.ok((select count(*)=1 from public.equipment),'operator cannot read another workspace');
insert into test.results values ('inspection',public.create_work_case(
 '20000000-0000-0000-0000-000000000001','inspection','2026-10-09 01:00:00+00',null,'Kiem tra dau ca','50000000-0000-0000-0000-000000000001'));
select test.ok((select code='KT-QC10-20261009-080000-0001' from public.work_cases where id=(select id from test.results where name='inspection')),'case code uses actual local timestamp');
select test.ok(public.create_work_case(
 '20000000-0000-0000-0000-000000000001','inspection','2026-10-09 01:00:00+00',null,'Kiem tra dau ca','50000000-0000-0000-0000-000000000001')
 =(select id from test.results where name='inspection'),'request retry returns existing case');
select test.fails($q$select public.create_work_case(
 '20000000-0000-0000-0000-000000000001','inspection','2026-10-09 01:00:00+00',null,'Different payload','50000000-0000-0000-0000-000000000001')$q$,
 '22023','request key cannot be reused with different payload');
insert into test.results values ('inspection2',public.create_work_case(
 '20000000-0000-0000-0000-000000000001','inspection','2026-10-09 01:00:00+00',null,'Second event','50000000-0000-0000-0000-000000000002'));
select test.ok((select code='KT-QC10-20261009-080000-0002' from public.work_cases where id=(select id from test.results where name='inspection2')),'events in same second receive distinct sequence');
update public.work_cases set actual_started_at='2026-10-09 02:00:00+00' where id=(select id from test.results where name='inspection');
select test.ok((select code='KT-QC10-20261009-080000-0001' and actual_started_at='2026-10-09 02:00:00+00' from public.work_cases where id=(select id from test.results where name='inspection')),'actual-time correction preserves assigned code');
select test.fails($q$update public.work_cases set code='KT-MANUAL' where id=(select id from test.results where name='inspection')$q$,'42501','cannot manually change case code');
select test.fails($q$select public.create_work_case(
 '20000000-0000-0000-0000-000000000002','inspection',now(),null,'Other equipment',gen_random_uuid())$q$,'42501','cannot create case across workspace');
insert into public.case_checks(case_id,item_no,label,abnormal,notes)
select id,1,'Brake',true,'Abnormal noise' from test.results where name='inspection';
update public.work_cases set submitted_at=now() where id=(select id from test.results where name='inspection');
insert into test.results values ('repair',public.convert_inspection_to_repair((select id from test.results where name='inspection')));
select test.ok(public.convert_inspection_to_repair((select id from test.results where name='inspection'))
 =(select id from test.results where name='repair'),'conversion retries return same repair order');
select test.ok((select count(*)=1 from public.work_cases where parent_case_id=(select id from test.results where name='inspection')),'inspection has exactly one child repair case');
select test.ok((select code like 'HS-%' from public.repair_orders where id=(select id from test.results where name='repair')),'repair dossier code is separate from case code');
select test.fails($q$insert into public.case_checks(case_id,item_no,label) select id,2,'Late item' from test.results where name='inspection'$q$,'22023','submitted inspection checklist is immutable');
with changed as (
 update public.repair_work_items set execution_status='in_progress'
 where repair_order_id=(select id from test.results where name='repair') returning id
) select test.ok((select count(*)=0 from changed),'operator cannot change technical progress');
select test.ok((select count(*)=0 from public.vw_inventory_balances),'operator does not see misleading zero stock ledger');

-- Technician: imports, corrections and independent progress.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
select public.import_monthly_metrics('00000000-0000-0000-0000-000000000001',
 '[{"equipment_code":"QC10","month":"2026-10-01","boxes":100,"teu":150,"operating_hours":120}]',
 '60000000-0000-0000-0000-000000000001');
select test.ok((select accumulated_hours=220 from public.equipment where code='QC10'),'monthly hours accumulate from baseline');
select public.import_monthly_metrics('00000000-0000-0000-0000-000000000001',
 '[{"equipment_code":"QC10","month":"2026-10-01","boxes":100,"teu":150,"operating_hours":120}]',
 '60000000-0000-0000-0000-000000000001');
select test.ok((select accumulated_hours=220 from public.equipment where code='QC10'),'same import does not double-count hours');
select public.import_monthly_metrics('00000000-0000-0000-0000-000000000001',
 '[{"equipment_code":"QC10","month":"2026-10-01","boxes":100,"teu":150,"operating_hours":100}]',
 '60000000-0000-0000-0000-000000000002');
select test.ok((select accumulated_hours=200 from public.equipment where code='QC10'),'correcting 120 to 100 subtracts 20 hours');
insert into public.monthly_operating_hours(equipment_id,month,operating_hours) values('20000000-0000-0000-0000-000000000001','2026-11-01',10);
select test.ok((select count(*)=1 from public.vw_monthly_metrics where month='2026-11-01' and operating_hours=10 and boxes is null),'hours-only month is visible');
delete from public.monthly_operating_hours where month='2026-11-01';
select test.ok((select accumulated_hours=200 from public.equipment where code='QC10'),'monthly deletion reconciles cumulative hours');
select test.fails($q$select public.import_monthly_metrics('00000000-0000-0000-0000-000000000001',
 '[{"equipment_code":"QC10","month":"2026-10-01","boxes":999,"teu":999,"operating_hours":900}]',gen_random_uuid())$q$,'23514','unphysical monthly hours are rejected');
select test.ok((select boxes=100 from public.monthly_production),'failed batch rolls back production too');
select test.fails($q$select public.set_member_roles('00000000-0000-0000-0000-000000000001',
 '10000000-0000-0000-0000-000000000002',array['TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[])$q$,'42501','technician cannot elevate roles');
update public.repair_work_items set root_cause='Wear',solution_plan='Replace',execution_result='Tested',execution_status='completed'
 where repair_order_id=(select id from test.results where name='repair');
select test.fails($q$update public.repair_work_items set acceptance_status='accepted' where repair_order_id=(select id from test.results where name='repair')$q$,
 '42501','technician cannot self-accept');
select test.fails($q$update public.repair_work_items set material_status='stock_available' where repair_order_id=(select id from test.results where name='repair')$q$,
 '42501','technician cannot confirm stock progress');
insert into public.maintenance_plans(equipment_id,name,interval_hours,interval_days,anchor_hours,anchor_date)
 values('20000000-0000-0000-0000-000000000001','250h or date',250,30,0,current_date-60);
select test.ok((select alert_level='overdue' from public.vw_maintenance_due),'calendar deadline triggers even before hours deadline');

-- Supply: authorized fields only, ledger idempotency and document ownership.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',false);
select test.fails($q$update public.repair_work_items set root_cause='Unauthorized' where repair_order_id=(select id from test.results where name='repair')$q$,
 '42501','supply cannot overwrite root cause');
update public.repair_work_items set material_status='stock_available',requisition_status='requisition_created'
 where repair_order_id=(select id from test.results where name='repair');
with inserted as (
 insert into public.repair_material_usages(repair_work_item_id,material_id,quantity,borrowed_quantity,lender)
 select id,'30000000-0000-0000-0000-000000000001',2,2,'Fixture lender'
 from public.repair_work_items where repair_order_id=(select id from test.results where name='repair')
 returning id
) insert into test.results select 'usage',id from inserted;
insert into test.results values ('receipt',public.post_stock_movement(
 '40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',10,'Opening receipt','70000000-0000-0000-0000-000000000001'));
select test.ok(public.post_stock_movement(
 '40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',10,'Opening receipt','70000000-0000-0000-0000-000000000001')
 =(select id from test.results where name='receipt'),'stock retry returns original voucher');
select test.ok((select quantity=10 from public.vw_inventory_balances),'stock retry does not add twice');
select public.post_stock_movement(
 '40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',-2,'Issue replacement','70000000-0000-0000-0000-000000000002',
 (select id from test.results where name='usage'));
select test.fails($q$select public.post_stock_movement(
 '40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',-1,'Over issue',gen_random_uuid(),
 (select id from test.results where name='usage'))$q$,'22023','cannot issue beyond declared usage quantity');
select test.fails($q$select public.post_stock_movement(
 '40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',-99,'Negative balance',gen_random_uuid())$q$,'22023','cannot create negative stock');
select test.fails($q$update public.repair_material_usages set document_status='documents_complete' where id=(select id from test.results where name='usage')$q$,
 '22023','cannot settle documents while borrowing outstanding');
update public.repair_material_usages set returned_quantity=2,document_status='documents_complete'
 where id=(select id from test.results where name='usage');
select test.fails($q$insert into public.technical_documents(equipment_id,kind,file_name,storage_path,mime_type,byte_size)
 values('20000000-0000-0000-0000-000000000001','plc','plc.pdf','ignored','application/pdf',100)$q$,
 '42501','supply cannot upload PLC document');

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
with inserted as (
 insert into public.technical_documents(equipment_id,order_id,kind,file_name,storage_path,mime_type,byte_size)
 values('20000000-0000-0000-0000-000000000001',(select id from test.results where name='repair'),
 'plc','plc.pdf','ignored','application/pdf',100) returning id
) insert into test.results select 'document',id from inserted;
select test.fails($q$update public.technical_documents set status='ready' where id=(select id from test.results where name='document')$q$,
 '22023','metadata cannot become ready before upload exists');
insert into storage.objects(bucket_id,name)
 select 'eam-documents',storage_path from public.technical_documents where id=(select id from test.results where name='document');
update public.technical_documents set status='ready' where id=(select id from test.results where name='document');
select test.ok((select count(*)=1 from storage.objects),'technician sees allowed storage object');
select test.fails($q$insert into storage.objects(bucket_id,name) values('eam-documents','arbitrary/path.pdf')$q$,
 '42501','unregistered storage path is denied');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000005',false);
select test.ok((select count(*)=0 from storage.objects),'other workspace cannot read storage object');
select test.ok((select count(*)=0 from public.repair_orders),'other workspace cannot read repair dossier');

-- Department head: acceptance, closing and immutable audit evidence.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
select test.fails($q$select public.set_member_roles('00000000-0000-0000-0000-000000000001',
 '10000000-0000-0000-0000-000000000001',array['KY_THUAT_VIEN']::public.eam_role[])$q$,'22023','cannot remove last active department head');
select test.ok(exists(select 1 from public.audit_logs where table_name='repair_work_items' and operation='UPDATE'
 and actor_id='10000000-0000-0000-0000-000000000002' and old_data->>'root_cause'='' and new_data->>'root_cause'='Wear'),
 'audit records authenticated actor and old/new values');
select test.fails($q$delete from public.audit_logs$q$,'42501','audit logs cannot be deleted by application users');
update public.repair_work_items set acceptance_status='accepted',dossier_status='closed'
 where repair_order_id=(select id from test.results where name='repair');
update public.repair_orders set closed_at=now() where id=(select id from test.results where name='repair');
select test.ok((select jsonb_array_length(work_items)=1 from public.vw_equipment_history where order_id=(select id from test.results where name='repair')),
 'history automatically includes work item and replaced material');
select test.fails($q$update public.repair_work_items set root_cause='After closure' where repair_order_id=(select id from test.results where name='repair')$q$,
 '22023','closed dossier cannot be edited');

reset role;
set role anon;
select test.fails('select * from public.equipment','42501','anonymous cannot read equipment');
reset role;
select test.ok(not exists(
 select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' and not c.relrowsecurity
),'every exposed business table has RLS enabled');
select test.ok(not exists(
 select 1 from pg_views where schemaname='public' and viewname like 'vw_%' and
 not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname=pg_views.viewname and 'security_invoker=true'=any(c.reloptions))
),'all aggregate views are security invoker');

