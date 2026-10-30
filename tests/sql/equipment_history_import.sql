begin;
select plan(6);
select test.create_supabase_user('history_manager','history-manager@example.com');
insert into public.workspace_memberships(workspace_id,user_id,role,active)
values('10000000-0000-0000-0000-000000000001',tests.get_supabase_uid('history_manager'),'TRUONG_BO_PHAN_KY_THUAT',true);
insert into public.equipment_history_entries(workspace_id,equipment_id,performed_on,content,source_file_id,source_sheet,source_row,source_key)
values('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','2022-01-10','Thay AVR','162uGNU57aMNIfxYM49aVZ8dfQKA95-wvrpqMEWmuPPM','Nhaplieu',2,'test-row-2');
select test.ok((select count(*)=1 from public.equipment_history_entries where source_key='test-row-2'),'legacy row stored');
select test.ok((select event_type='legacy' and work_items->0->>'performed_on'='2022-01-10' from public.vw_equipment_history where event_key like 'legacy:%'),'legacy row appears in history view');
set local role authenticated;
select set_config('request.jwt.claim.sub',tests.get_supabase_uid('history_manager')::text,true);
select test.ok((select count(*)=1 from public.equipment_history_entries where source_key='test-row-2'),'authorized member can read import');
select test.fails($q$insert into public.equipment_history_entries(workspace_id,equipment_id,performed_on,content,source_file_id,source_sheet,source_row,source_key) values('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','2022-01-11','Không được chèn','x','y',3,'z')$q$,'42501','authenticated users cannot import directly');
reset role;
select test.fails($q$insert into public.equipment_history_entries(workspace_id,equipment_id,performed_on,content,source_file_id,source_sheet,source_row,source_key) values('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','2022-01-11','Sai workspace','x','y',3,'z')$q$,'22023','equipment must belong to workspace');
select test.fails($q$insert into public.equipment_history_entries(workspace_id,equipment_id,performed_on,content,source_file_id,source_sheet,source_row,source_key) values('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','2022-01-11','Trùng','162uGNU57aMNIfxYM49aVZ8dfQKA95-wvrpqMEWmuPPM','Nhaplieu',2,'test-row-2')$q$,'23505','source rows are idempotent');
select * from finish();
rollback;

