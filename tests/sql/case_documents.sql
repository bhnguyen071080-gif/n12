-- Synthetic fixtures only, run after personal_followup.sql on disposable PostgreSQL.
create table test.document_state(label text primary key,data jsonb);
grant select,insert on test.document_state to authenticated;
grant usage on schema test to service_role;
grant select on test.document_state,test.results to service_role;
grant execute on function test.ok(boolean,text),test.fails(text,text,text) to service_role;
create function test.document_payload(p_case uuid,p_kind text) returns jsonb language sql as $$
 select jsonb_build_object('schema_version',1,'kind',p_kind,'company','Synthetic company','department','Synthetic technical department',
 'unit','Synthetic unit','location','Synthetic location','document_at','2026-10-13T09:30','equipment_label','Synthetic equipment',
 'form_code','TEST-FORM','document_number','TEST-001','inspection_subject','Synthetic inspection','reason','Synthetic repair','warehouse','Synthetic warehouse',
 'participants','[]'::jsonb,'cause','Synthetic cause','solution','Synthetic solution','signer_names','["","","","",""]'::jsonb,'amount_words','',
 'lines',coalesce((select jsonb_agg(jsonb_build_object('usage_id',l->>'usage_id','name',l->>'name','specification','','catalogue_code',l->>'code',
 'unit',l->>'unit','requested',l->'quantity','issued',null,'unit_price',null,'limit_text','','used_text','','condition',l->>'condition','notes',''))
 from jsonb_array_elements(public.get_case_document_source(p_case,p_kind)->'data'->'lines') l),'[]'::jsonb));
$$;
grant execute on function test.document_payload(uuid,text) to authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
set role authenticated;
insert into test.document_state values('business_before',jsonb_build_object(
 'followup',(select to_jsonb(f) from public.case_material_followups f where case_id=(select id from test.results where name='personal_case')),
 'items',(select jsonb_agg(to_jsonb(i) order by i.id) from public.repair_work_items i where repair_order_id=(select id from test.results where name='personal_order')),
 'usages',(select jsonb_agg(to_jsonb(u) order by u.id) from public.repair_material_usages u where repair_work_item_id=(select id from test.results where name='personal_item'))));
insert into test.document_state values('source_before',public.get_case_document_source((select id from test.results where name='personal_case'),'condition_minutes'));
insert into test.document_state values('payload',test.document_payload((select id from test.results where name='personal_case'),'condition_minutes'));
insert into test.results values('print_minutes',public.save_case_document((select id from test.results where name='personal_case'),'condition_minutes',
 (select data from test.document_state where label='payload'),(select data->>'source_hash' from test.document_state where label='source_before'),'f0000000-0000-0000-0000-000000000001'));
select test.ok((select revision=1 and drive_state='pending' and snapshot->'source'->>'case_id'=(select id::text from test.results where name='personal_case') from public.case_documents where id=(select id from test.results where name='print_minutes')),'snapshot binds case/equipment server-side and remains pending Drive');
select test.ok(public.save_case_document((select id from test.results where name='personal_case'),'condition_minutes',(select data from test.document_state where label='payload'),
 (select data->>'source_hash' from test.document_state where label='source_before'),'f0000000-0000-0000-0000-000000000001')=(select id from test.results where name='print_minutes'),'retry returns the same print snapshot');
select test.fails($q$select public.save_case_document((select id from test.results where name='personal_case'),'condition_minutes',
 jsonb_set((select data from test.document_state where label='payload'),'{company}','"Different"'),(select data->>'source_hash' from test.document_state where label='source_before'),'f0000000-0000-0000-0000-000000000001')$q$,'22023','same request key cannot change document payload');
select test.fails($q$select public.save_case_document((select id from test.results where name='personal_case'),'condition_minutes',
 (select data from test.document_state where label='payload'),repeat('0',64),gen_random_uuid())$q$,'40001','stale source hash rejected');
select test.fails($q$select public.save_case_document((select id from test.results where name='personal_case'),'condition_minutes',
 (select data from test.document_state where label='payload')||'{"return_status":"completed"}',
 (select data->>'source_hash' from test.document_state where label='source_before'),gen_random_uuid())$q$,'22023','database rejects extra business-status fields in print payload');
select test.fails($q$select public.save_case_document((select id from test.results where name='personal_case'),'condition_minutes',
 jsonb_set((select data from test.document_state where label='payload'),'{lines,0,requested}','1.2345'),
 (select data->>'source_hash' from test.document_state where label='source_before'),gen_random_uuid())$q$,'22023','database rejects unsupported quantity precision');
select test.fails($q$select public.save_case_document((select id from test.results where name='personal_case'),'condition_minutes',
 jsonb_set((select data from test.document_state where label='payload'),'{lines,0,usage_id}','"00000000-0000-0000-0000-000000000001"'),
 (select data->>'source_hash' from test.document_state where label='source_before'),gen_random_uuid())$q$,'22023','material usage from another case rejected');
select test.fails($q$insert into public.case_documents(workspace_id,case_id,kind,revision,request_key,created_by,snapshot)
 values('00000000-0000-0000-0000-000000000001',(select id from test.results where name='personal_case'),'condition_minutes',2,gen_random_uuid(),auth.uid(),'{}')$q$,'42501','direct snapshot insertion cannot bypass source validation');
select test.fails($q$update public.case_documents set snapshot='{}' where id=(select id from test.results where name='print_minutes')$q$,'42501','snapshot cannot be overwritten');
select test.fails($q$delete from public.case_documents where id=(select id from test.results where name='print_minutes')$q$,'42501','snapshot cannot be deleted');
insert into test.results values('print_minutes2',public.save_case_document((select id from test.results where name='personal_case'),'condition_minutes',
 jsonb_set((select data from test.document_state where label='payload'),'{document_number}','"TEST-002"'),(select data->>'source_hash' from test.document_state where label='source_before'),'f0000000-0000-0000-0000-000000000002'));
select test.ok((select revision=2 from public.case_documents where id=(select id from test.results where name='print_minutes2')),'new edits append a new revision');
select test.ok((select snapshot->'payload'->>'document_number'='TEST-001' from public.case_documents where id=(select id from test.results where name='print_minutes')),'earlier printed document is unchanged');
insert into test.document_state values('lease',public.claim_document_drive((select id from test.results where name='print_minutes'),'SYNTHETIC_DRIVE_FILE_001'));
select test.fails($q$select public.claim_document_drive((select id from test.results where name='print_minutes'),'SYNTHETIC_DRIVE_FILE_002')$q$,'40001','concurrent Drive archive lease is exclusive');
select test.fails($q$select public.finish_document_drive((select id from test.results where name='print_minutes'),(select (data->>'drive_lease')::uuid from test.document_state where label='lease'),repeat('a',64),auth.uid())$q$,'42501','browser cannot falsely confirm a Drive upload');
select public.release_document_drive((select id from test.results where name='print_minutes'),(select (data->>'drive_lease')::uuid from test.document_state where label='lease'));
insert into test.document_state values('lease2',public.claim_document_drive((select id from test.results where name='print_minutes'),'SYNTHETIC_DRIVE_FILE_002'));
select test.ok((select drive_file_id='SYNTHETIC_DRIVE_FILE_001' from public.case_documents where id=(select id from test.results where name='print_minutes')),'retry reuses preallocated Drive ID instead of duplicating files');
reset role;
set role service_role;
select test.fails($q$select public.finish_document_drive((select id from test.results where name='print_minutes'),gen_random_uuid(),repeat('a',64),'10000000-0000-0000-0000-000000000001')$q$,'40001','old/wrong Drive lease cannot finalize');
select test.fails($q$select public.finish_document_drive((select id from test.results where name='print_minutes'),(select (data->>'drive_lease')::uuid from test.document_state where label='lease2'),repeat('a',64),'10000000-0000-0000-0000-000000000005')$q$,'42501','server finalization checks actor workspace access');
select public.finish_document_drive((select id from test.results where name='print_minutes'),(select (data->>'drive_lease')::uuid from test.document_state where label='lease2'),repeat('a',64),'10000000-0000-0000-0000-000000000001');
reset role;
select test.ok((select drive_state='saved' and drive_lease is null and drive_pdf_sha256=repeat('a',64) from public.case_documents where id=(select id from test.results where name='print_minutes')),'only verified backend may mark Drive complete');
select test.ok(exists(select 1 from public.audit_logs where table_name='case_documents' and record_id=(select id from test.results where name='print_minutes') and actor_id='10000000-0000-0000-0000-000000000001' and new_data->>'drive_state'='saved'),'archive audit records the authenticated actor');
select test.fails($q$update public.case_documents set snapshot='{}' where id=(select id from test.results where name='print_minutes')$q$,'42501','immutable trigger also protects accidental privileged rewrite');
set role authenticated;
select test.ok((select data from test.document_state where label='business_before')=jsonb_build_object(
 'followup',(select to_jsonb(f) from public.case_material_followups f where case_id=(select id from test.results where name='personal_case')),
 'items',(select jsonb_agg(to_jsonb(i) order by i.id) from public.repair_work_items i where repair_order_id=(select id from test.results where name='personal_order')),
 'usages',(select jsonb_agg(to_jsonb(u) order by u.id) from public.repair_material_usages u where repair_work_item_id=(select id from test.results where name='personal_item'))),'save/archive does not modify repair, installation or common return state');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',false);
select test.ok((select count(*)=0 from public.case_documents where kind='condition_minutes'),'supply role cannot read technical minutes');
select test.fails($q$select public.get_case_document_source((select id from test.results where name='personal_case'),'condition_minutes')$q$,'42501','supply role cannot fetch technical minutes source');
insert into test.results values('print_voucher',public.save_case_document((select id from test.results where name='personal_case'),'material_requisition',
 test.document_payload((select id from test.results where name='personal_case'),'material_requisition'),
 public.get_case_document_source((select id from test.results where name='personal_case'),'material_requisition')->>'source_hash','f0000000-0000-0000-0000-000000000003'));
select test.ok((select revision=1 and snapshot->'payload'->'lines'->0->'issued'='null'::jsonb from public.case_documents where id=(select id from test.results where name='print_voucher')),'supply can create voucher without inventing actual issue quantities');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',false);
select test.ok((select count(*)=0 from public.case_documents),'operator cannot read print snapshots');
select test.fails($q$select public.get_case_document_source((select id from test.results where name='personal_case'),'material_requisition')$q$,'42501','operator cannot fetch print source');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000005',false);
select test.ok((select count(*)=0 from public.case_documents),'cross-workspace snapshots are hidden');
select test.fails($q$select public.claim_document_drive((select id from test.results where name='print_minutes2'),'SYNTHETIC_DRIVE_FILE_003')$q$,'42501','cross-workspace Drive archive denied');
reset role;
set role anon;
select test.fails($q$select * from public.case_documents$q$,'42501','anonymous snapshots denied');
select test.fails($q$select private.case_document_source((select id from test.results where name='personal_case'),'condition_minutes')$q$,'42501','anonymous definer invocation denied');
reset role;

-- Document-only inspection rows must work before any material usage is entered.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
set role authenticated;
insert into test.document_state values('manual_line',
 (select data->'lines'->0 from test.document_state where label='payload')
 ||jsonb_build_object('usage_id',null,'limit_text','1000 hours','used_text','660 hours'));
insert into test.document_state values('manual_payload',jsonb_set(
 (select data from test.document_state where label='payload'),'{lines}',
 jsonb_build_array((select data from test.document_state where label='manual_line'),(select data from test.document_state where label='manual_line'))));
insert into test.results values('manual_minutes',public.save_case_document((select id from test.results where name='personal_case'),'condition_minutes',
 (select data from test.document_state where label='manual_payload'),public.get_case_document_source((select id from test.results where name='personal_case'),'condition_minutes')->>'source_hash',
 'f0000000-0000-0000-0000-000000000010'));
select test.ok((select snapshot->'payload'->'lines'->0->'usage_id'='null'::jsonb
 and snapshot->'payload'->'lines'->0->>'limit_text'='1000 hours'
 and snapshot->'payload'->'lines'->1->>'used_text'='660 hours' from public.case_documents where id=(select id from test.results where name='manual_minutes')),
 'multiple manual rows preserve limit and actual values without fabricated usage IDs');
select test.ok(public.save_case_document((select id from test.results where name='personal_case'),'condition_minutes',
 (select data from test.document_state where label='manual_payload'),public.get_case_document_source((select id from test.results where name='personal_case'),'condition_minutes')->>'source_hash',
 'f0000000-0000-0000-0000-000000000010')=(select id from test.results where name='manual_minutes'),'manual minutes retries do not create duplicate snapshots');
select test.fails($q$select public.save_case_document((select id from test.results where name='personal_case'),'material_requisition',
 (select data from test.document_state where label='manual_payload')||'{"kind":"material_requisition"}',
 public.get_case_document_source((select id from test.results where name='personal_case'),'material_requisition')->>'source_hash',gen_random_uuid())$q$,'22023','manual inspection row cannot become a stock requisition');
select test.fails($q$select public.save_case_document((select id from test.results where name='personal_case'),'condition_minutes',
 jsonb_set((select data from test.document_state where label='manual_payload'),'{lines,0,used_text}',to_jsonb(repeat('x',201))),
 public.get_case_document_source((select id from test.results where name='personal_case'),'condition_minutes')->>'source_hash',gen_random_uuid())$q$,'22023','manual actual value length remains bounded');
select test.fails($q$select public.save_case_document((select id from test.results where name='personal_case'),'condition_minutes',
 jsonb_set((select data from test.document_state where label='manual_payload'),'{lines,0,usage_id}','123'),
 public.get_case_document_source((select id from test.results where name='personal_case'),'condition_minutes')->>'source_hash',gen_random_uuid())$q$,'22023','only explicit null or linked string usage IDs are accepted');
select test.ok((select data from test.document_state where label='business_before')=jsonb_build_object(
 'followup',(select to_jsonb(f) from public.case_material_followups f where case_id=(select id from test.results where name='personal_case')),
 'items',(select jsonb_agg(to_jsonb(i) order by i.id) from public.repair_work_items i where repair_order_id=(select id from test.results where name='personal_order')),
 'usages',(select jsonb_agg(to_jsonb(u) order by u.id) from public.repair_material_usages u where repair_work_item_id=(select id from test.results where name='personal_item'))),
 'manual minutes do not change technical progress, material usage, installation or return state');
insert into test.results values('empty_material_case',public.create_tracking_case(
 (select equipment_id from public.work_cases where id=(select id from test.results where name='personal_case')),'inspection','2026-10-16','Synthetic inspection without materials','f0000000-0000-0000-0000-000000000011'));
insert into test.results values('empty_material_minutes',public.save_case_document((select id from test.results where name='empty_material_case'),'condition_minutes',
 jsonb_set(test.document_payload((select id from test.results where name='empty_material_case'),'condition_minutes'),'{lines}',jsonb_build_array((select data from test.document_state where label='manual_line'))),
 public.get_case_document_source((select id from test.results where name='empty_material_case'),'condition_minutes')->>'source_hash','f0000000-0000-0000-0000-000000000012'));
select test.ok((select snapshot->'payload'->'lines'->0->>'used_text'='660 hours' from public.case_documents where id=(select id from test.results where name='empty_material_minutes'))
 and not exists(select 1 from public.repair_material_usages u join public.repair_work_items i on i.id=u.repair_work_item_id join public.repair_orders r on r.id=i.repair_order_id where r.case_id=(select id from test.results where name='empty_material_case')),
 'minutes save limits and actual values when case has no material usage, without creating any usage');
reset role;
