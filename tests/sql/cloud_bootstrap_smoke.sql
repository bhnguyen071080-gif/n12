-- Explicit, rollback-only cloud commissioning check. Never persist these rows.
-- Execute as postgres in a single connection. No emails, passwords or real data.
begin;
create temporary table commissioning_ids(label text primary key,id uuid not null);
grant select,insert on commissioning_ids to authenticated;
insert into commissioning_ids select name,gen_random_uuid() from unnest(array[
 'actor','outsider','workspace','other_workspace','equipment','material','case_key','material_key']) name;
create function pg_temp.must(p_ok boolean,p_label text) returns void
language plpgsql as $$ begin
 if p_ok is not true then raise exception 'Commissioning failed: %',p_label; end if;
end; $$;

insert into auth.users(id) select id from commissioning_ids where label in ('actor','outsider');
insert into public.workspaces(id,name) select id,'Temporary commissioning only'
 from commissioning_ids where label in ('workspace','other_workspace');
insert into public.workspace_memberships(workspace_id,user_id,role)
 select w.id,a.id,r from commissioning_ids w cross join commissioning_ids a
 cross join unnest(enum_range(null::public.eam_role)) r where w.label='workspace' and a.label='actor';
insert into public.workspace_memberships(workspace_id,user_id,role)
 select w.id,a.id,'TRUONG_BO_PHAN_KY_THUAT' from commissioning_ids w cross join commissioning_ids a
 where w.label='other_workspace' and a.label='outsider';
select set_config('request.jwt.claim.sub',(select id::text from commissioning_ids where label='actor'),true);
set local role authenticated;
insert into public.equipment(id,workspace_id,code,name,category) select e.id,w.id,'COMMISSIONING_TEST','Temporary commissioning','QC'
 from commissioning_ids e cross join commissioning_ids w where e.label='equipment' and w.label='workspace';
insert into public.materials(id,workspace_id,code,name,unit,service_limit_hours) select m.id,w.id,'COMMISSIONING_CABLE','Temporary cable','bộ',1000
 from commissioning_ids m cross join commissioning_ids w where m.label='material' and w.label='workspace';

select pg_temp.must(public.import_operating_months((select id from commissioning_ids where label='workspace'),
 '[{"equipment_code":"COMMISSIONING_TEST","month":"2026-01-01","operating_hours":100},{"equipment_code":"COMMISSIONING_TEST","month":"2026-02-01","operating_hours":0},{"equipment_code":"COMMISSIONING_TEST","month":"2026-03-01","operating_hours":200}]',gen_random_uuid())=3,'import three independent hour records');
select public.import_container_months((select id from commissioning_ids where label='workspace'),
 '[{"equipment_code":"COMMISSIONING_TEST","month":"2026-01-01","boxes":3382}]',gen_random_uuid());
select pg_temp.must((select boxes=3382 from public.monthly_production),'container pieces, not converted units');
select pg_temp.must((select accumulated_hours=300 from public.equipment),'accumulated operating hours');
select public.import_operating_months((select id from commissioning_ids where label='workspace'),
 '[{"equipment_code":"COMMISSIONING_TEST","month":"2026-01-01","operating_hours":110}]',gen_random_uuid());
select pg_temp.must((select accumulated_hours=310 from public.equipment),'correction applies delta instead of double counting');
select pg_temp.must((select sum(operating_hours)=310 and count(*)=3 from public.report_operating_hours(
 (select id from commissioning_ids where label='equipment'),'2026-01-01','2026-03-01')),'inclusive month range');
select pg_temp.must((select count(*) filter(where operating_hours is null)=1 from public.report_operating_hours(
 (select id from commissioning_ids where label='equipment'),'2026-01-01','2026-04-01')),'missing month stays null');

insert into commissioning_ids values('case',public.create_tracking_case((select id from commissioning_ids where label='equipment'),
 'repair','2026-01-15','Temporary repair',(select id from commissioning_ids where label='case_key')));
select pg_temp.must(public.create_tracking_case((select id from commissioning_ids where label='equipment'),
 'repair','2026-01-15','Temporary repair',(select id from commissioning_ids where label='case_key'))=
 (select id from commissioning_ids where label='case'),'case retry is idempotent');
insert into commissioning_ids select 'order',id from public.repair_orders where case_id=(select id from commissioning_ids where label='case');
insert into commissioning_ids select 'item',id from public.repair_work_items where repair_order_id=(select id from commissioning_ids where label='order');
insert into commissioning_ids values('usage',public.add_tracking_material((select id from commissioning_ids where label='item'),
 (select id from commissioning_ids where label='material'),1,'borrowed',false,'Temporary position',
 (select id from commissioning_ids where label='material_key')));
select pg_temp.must((select installed_at is null from public.repair_material_usages),'borrow does not mean installed');
select pg_temp.must((select count(*)=0 from public.report_material_hours((select id from commissioning_ids where label='equipment'),'2026-03-01')),'uninstalled material excluded');
select public.set_material_return((select id from commissioning_ids where label='case'),'completed','2026-02-01 09:00+07',
 (select version_no from public.case_material_followups),'Temporary return');
select pg_temp.must((select installed_at is null from public.repair_material_usages),'return completion does not install material');
select public.add_tracking_material((select id from commissioning_ids where label='item'),
 (select id from commissioning_ids where label='material'),2,'issued',false,'Other temporary position',gen_random_uuid());
select pg_temp.must((select return_status='pending' and completed_at is null from public.case_material_followups),'new material reopens common return');
select public.update_tracking_material((select id from commissioning_ids where label='usage'),'issued',true);
select pg_temp.must((select installed_at='2026-01-15 00:00+07' from public.repair_material_usages where id=
 (select id from commissioning_ids where label='usage')),'installation uses actual history date');
select pg_temp.must((select recorded_hours=310 and remaining_hours=690 from public.report_material_hours(
 (select id from commissioning_ids where label='equipment'),'2026-03-01')),'whole months since latest replacement');
select pg_temp.must((select work_items->0->>'performed_on'='2026-01-15' from public.vw_equipment_history),'automatic equipment history');
select pg_temp.must(length(public.get_case_document_source((select id from commissioning_ids where label='case'),'condition_minutes')->>'source_hash')=64,'document source is bound and hashed');

reset role;
select pg_temp.must(exists(select 1 from public.audit_logs where table_name='case_material_followups'
 and old_data->>'return_status'='completed' and new_data->>'return_status'='pending'),'common return audit');
select pg_temp.must(not has_function_privilege('anon','public.create_tracking_case(uuid,public.case_kind,date,text,uuid)','EXECUTE'),'anonymous case mutation denied');
select pg_temp.must(not has_table_privilege('anon','public.case_documents','SELECT'),'anonymous document reads denied');
select set_config('request.jwt.claim.sub',(select id::text from commissioning_ids where label='outsider'),true);
set local role authenticated;
select pg_temp.must((select count(*)=0 from public.equipment),'other workspace equipment hidden');
select pg_temp.must((select count(*)=0 from public.case_material_followups),'other workspace return records hidden');
select pg_temp.must((select count(*)=0 from public.vw_equipment_history),'history view respects row security');
reset role;
rollback;
select 'passed' as commissioning_result,
 (select count(*) from public.equipment) as remaining_equipment,
 (select count(*) from public.work_cases) as remaining_cases,
 (select count(*) from auth.users) as remaining_users;
