-- Structural checks, usable after the existing disposable regression suite.
select test.ok(not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity),
 'all public business tables have RLS');
select test.ok(not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='v' and not coalesce(c.reloptions @> array['security_invoker=true'],false)),
 'all public report views use invoker security');
select test.ok(not has_table_privilege('authenticated','private.followup_requests','SELECT')
 and not has_table_privilege('anon','private.followup_requests','SELECT'),
 'internal retry ledger deliberately has no client access');
select test.ok((select count(*)=21 from pg_indexes where indexname in (
 'followup_requests_actor_idx','import_requests_actor_idx','stock_requests_actor_idx','stock_requests_voucher_idx',
 'downtime_order_idx','failure_created_by_idx','hours_updated_by_idx','other_cargo_updated_by_idx','production_updated_by_idx',
 'usages_material_idx','orders_created_by_idx','sources_created_by_idx','sync_runs_actor_idx','sync_runs_workspace_idx',
 'documents_case_idx','documents_created_by_idx','documents_order_idx','voucher_lines_voucher_idx','vouchers_created_by_idx',
 'vouchers_warehouse_idx','cases_created_by_idx')), 'missing FK indexes are covered');
select test.ok((select qual like '%SELECT auth.uid()%' from pg_policies where schemaname='public'
 and tablename='workspace_memberships' and policyname='membership_read'), 'membership policy caches request identity');
