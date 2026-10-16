-- Cloud deployment hardening; no business data or role membership changes.
begin;

-- The Dashboard's automatic-RLS event trigger is infrastructure, not an RPC.
-- Keep the trigger working, but never let API clients invoke its definer body.
do $$
begin
 if to_regprocedure('public.rls_auto_enable()') is not null then
  revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
 end if;
end; $$;

create index followup_requests_actor_idx on private.followup_requests(actor_id);
create index import_requests_actor_idx on private.import_requests(actor_id);
create index stock_requests_actor_idx on private.stock_requests(actor_id);
create index stock_requests_voucher_idx on private.stock_requests(voucher_id);
create index downtime_order_idx on public.equipment_downtimes(repair_order_id);
create index failure_created_by_idx on public.failure_incidents(created_by);
create index hours_updated_by_idx on public.monthly_operating_hours(updated_by);
create index other_cargo_updated_by_idx on public.monthly_other_cargo(updated_by);
create index production_updated_by_idx on public.monthly_production(updated_by);
create index usages_material_idx on public.repair_material_usages(material_id);
create index orders_created_by_idx on public.repair_orders(created_by);
create index sources_created_by_idx on public.sheet_sources(created_by);
create index sync_runs_actor_idx on public.sheet_sync_runs(actor_id);
create index sync_runs_workspace_idx on public.sheet_sync_runs(workspace_id);
create index documents_case_idx on public.technical_documents(case_id);
create index documents_created_by_idx on public.technical_documents(created_by);
create index documents_order_idx on public.technical_documents(order_id);
create index voucher_lines_voucher_idx on public.voucher_lines(voucher_id);
create index vouchers_created_by_idx on public.vouchers(created_by);
create index vouchers_warehouse_idx on public.vouchers(warehouse_id);
create index cases_created_by_idx on public.work_cases(created_by);

-- Cache the request's user identity once per statement. Keep each policy's
-- ownership/role predicates, action and permissive/restrictive mode unchanged.
do $$
declare p record; q text; c text;
begin
 for p in select * from pg_policies where schemaname='public'
  and (qual like '%auth.uid()%' or with_check like '%auth.uid()%') loop
  q:=replace(p.qual,'auth.uid()','(select auth.uid())');
  c:=replace(p.with_check,'auth.uid()','(select auth.uid())');
  execute format('alter policy %I on %I.%I%s%s',p.policyname,p.schemaname,p.tablename,
   case when q is not null then ' using ('||q||')' else '' end,
   case when c is not null then ' with check ('||c||')' else '' end);
 end loop;
end; $$;

comment on table private.followup_requests is
 'Internal idempotency ledger: no API grants or user RLS policies by design.';
commit;
