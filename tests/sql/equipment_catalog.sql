-- Disposable fixture only. All catalog tests are rolled back.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select test.ok(public.save_equipment_catalog('00000000-0000-0000-0000-000000000001',null,null,'70000000-0000-0000-0000-000000000001',
 'test_auto','Khung thử tự động','SPREADER_AUTO','stopped','SERIAL-TEST',null,'Ghi chú thử',array['OLD_TEST'],125.5)='70000000-0000-0000-0000-000000000001','leader creates spreader with explicit baseline');
select test.ok((select code='TEST_AUTO' and status='stopped' and accumulated_hours=125.5 and catalog_version=1 and manufacture_year is null
 from public.equipment where id='70000000-0000-0000-0000-000000000001'),'catalog normalizes code without inventing year and preserves derived status');
select test.ok(public.save_equipment_catalog('00000000-0000-0000-0000-000000000001',null,null,'70000000-0000-0000-0000-000000000001',
 'TEST_AUTO','Khung thử tự động','SPREADER_AUTO','stopped','SERIAL-TEST',null,'Ghi chú thử',array['OLD_TEST'],125.5)='70000000-0000-0000-0000-000000000001','creation retry returns same equipment');
select test.fails($q$select public.save_equipment_catalog('00000000-0000-0000-0000-000000000001',null,null,'70000000-0000-0000-0000-000000000001',
 'TEST_AUTO','Nội dung khác','SPREADER_AUTO','stopped','SERIAL-TEST',null,'Ghi chú thử',array['OLD_TEST'],125.5)$q$,'22023','same create key cannot overwrite catalog');
select test.fails($q$select public.save_equipment_catalog('00000000-0000-0000-0000-000000000001',null,null,'70000000-0000-0000-0000-000000000002',
 'TEST_AUTO','Trùng mã','QC','available',null,null,'',array[]::text[],0)$q$,'23505','duplicate workspace code rejected');
select test.ok(public.save_equipment_catalog('00000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001',1,gen_random_uuid(),
 'TEST_AUTO','Đã chỉnh tên','SPREADER_SEMI_AUTO','available',null,2020,'',array[]::text[],125.5)='70000000-0000-0000-0000-000000000001','leader edits metadata');
select test.ok((select catalog_version=2 and status='available' and accumulated_hours=125.5 from public.equipment where id='70000000-0000-0000-0000-000000000001'),'metadata update increments once and retains hours');
select test.ok(public.save_equipment_catalog('00000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001',1,gen_random_uuid(),
 'TEST_AUTO','Đã chỉnh tên','SPREADER_SEMI_AUTO','available',null,2020,'',array[]::text[],125.5)='70000000-0000-0000-0000-000000000001','lost-response update retry is safe');
select test.fails($q$select public.save_equipment_catalog('00000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001',1,gen_random_uuid(),
 'TEST_AUTO','Tên cũ ghi đè','QC','available',null,2020,'',array[]::text[],125.5)$q$,'40001','stale edit cannot overwrite newer data');
select test.fails($q$select public.save_equipment_catalog('00000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001',2,gen_random_uuid(),
 'NEW_CODE','Đã chỉnh tên','QC','available',null,2020,'',array[]::text[],125.5)$q$,'22023','code cannot change');
select test.fails($q$select public.save_equipment_catalog('00000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001',2,gen_random_uuid(),
 'TEST_AUTO','Đã chỉnh tên','QC','available',null,2020,'',array[]::text[],0)$q$,'22023','edit cannot reset baseline');
select test.fails($q$select public.save_equipment_catalog('00000000-0000-0000-0000-000000000001',null,null,gen_random_uuid(),
 'TEST_BAD','Thử','QC','available',null,null,'',array['Same','same'],0)$q$,'22023','case-insensitive duplicate aliases rejected');
select test.fails($q$select public.save_equipment_catalog('00000000-0000-0000-0000-000000000001',null,null,gen_random_uuid(),
 'TEST_BAD','Thử','QC','available',null,null,'',array[]::text[],null)$q$,'22023','unknown baseline is not silently zero');
select test.fails($q$select public.save_equipment_catalog('00000000-0000-0000-0000-000000000001',null,null,gen_random_uuid(),
 'TEST_BAD','Thử','QC','available',null,2099,'',array[]::text[],0)$q$,'22023','future manufacture year rejected');
select test.fails($q$update public.equipment set catalog_version=99 where id='70000000-0000-0000-0000-000000000001'$q$,'42501','manual version changes rejected');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select test.fails($q$select public.save_equipment_catalog('00000000-0000-0000-0000-000000000001',null,null,gen_random_uuid(),
 'TEST_DENIED','Thử','QC','available',null,null,'',array[]::text[],0)$q$,'42501','technician cannot create equipment');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000005',true);
select test.fails($q$select public.save_equipment_catalog('00000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001',2,gen_random_uuid(),
 'TEST_AUTO','Thử','QC','available',null,null,'',array[]::text[],125.5)$q$,'42501','leader of other workspace cannot edit');
set local role anon;
select test.fails($q$select public.save_equipment_catalog('00000000-0000-0000-0000-000000000001',null,null,gen_random_uuid(),
 'TEST_ANON','Thử','QC','available',null,null,'',array[]::text[],0)$q$,'42501','anonymous cannot execute catalog write');
reset role;
select test.ok((select not prosecdef from pg_proc where oid='public.save_equipment_catalog(uuid,uuid,integer,uuid,text,text,text,text,text,integer,text,text[],numeric)'::regprocedure),'catalog RPC never bypasses RLS');
rollback;
