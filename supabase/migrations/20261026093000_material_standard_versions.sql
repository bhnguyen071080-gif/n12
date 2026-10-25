-- Port standards change over time. Append a dated version instead of overwriting
-- the former value so historical alerts and audit evidence remain reproducible.
begin;

create table public.material_limit_versions(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 material_id uuid not null references public.materials(id),
 effective_from date not null,
 limit_hours numeric(18,2) not null check(limit_hours>0),
 warning_hours numeric(18,2) not null default 0 check(warning_hours>=0 and warning_hours<limit_hours),
 source_document text not null check(length(btrim(source_document)) between 1 and 300),
 notes text not null default '' check(length(notes)<=1000),
 request_key uuid not null unique,
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 unique(material_id,effective_from)
);
create index material_limit_versions_workspace_date_idx on public.material_limit_versions(workspace_id,effective_from desc);
create index material_limit_versions_material_date_idx on public.material_limit_versions(material_id,effective_from desc);
create index material_limit_versions_created_by_idx on public.material_limit_versions(created_by);

create function private.guard_material_limit_version() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op<>'INSERT' then raise exception using errcode='42501',message='Định mức đã ban hành là bất biến; hãy tạo phiên bản hiệu lực mới';end if;
 if not exists(select 1 from public.materials m where m.id=new.material_id and m.workspace_id=new.workspace_id) then raise exception using errcode='22023',message='Vật tư không thuộc workspace';end if;
 if new.created_by is distinct from auth.uid() then raise exception using errcode='42501',message='Sai người tạo';end if;
 return new;
end;$$;
revoke all on function private.guard_material_limit_version() from public,anon,authenticated;
create trigger material_limit_version_guard before insert or update or delete on public.material_limit_versions for each row execute function private.guard_material_limit_version();
create trigger audit_row after insert on public.material_limit_versions for each row execute function private.audit_change();

alter table public.material_limit_versions enable row level security;
revoke all on public.material_limit_versions from public,anon,authenticated;
grant select,insert on public.material_limit_versions to authenticated;
create policy material_limit_version_read on public.material_limit_versions for select to authenticated using(private.has_role(workspace_id,enum_range(null::public.eam_role)));
create policy material_limit_version_insert on public.material_limit_versions for insert to authenticated with check(created_by=(select auth.uid()) and private.has_role(workspace_id,array['CAN_BO_VAT_TU','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]));

create or replace function public.report_material_hours(p_equipment uuid,p_to date)
returns table(material_id uuid,material_code text,material_name text,unit text,usage_id uuid,case_id uuid,case_code text,order_code text,"position" text,
 performed_on date,from_month date,to_month date,recorded_hours numeric,missing_months integer,limit_hours numeric,remaining_hours numeric,alert_level text)
language plpgsql stable security invoker set search_path='' as $$
begin
 perform private.validate_hour_range(p_equipment,p_to,p_to);
 return query with latest as(
 select distinct on(m.id) m.id,m.code,m.name,m.unit,u.id usage_id,c.id case_id,c.code case_code,r.code order_code,u.installation_position as "position",
 case when c.tracking_only then i.performed_on else (u.installed_at at time zone 'Asia/Bangkok')::date end performed_on,
 coalesce(standard.limit_hours,m.service_limit_hours) service_limit_hours,coalesce(standard.warning_hours,m.service_warning_hours) service_warning_hours
 from public.repair_material_usages u join public.materials m on m.id=u.material_id join public.repair_work_items i on i.id=u.repair_work_item_id
 join public.repair_orders r on r.id=i.repair_order_id left join public.work_cases c on c.id=r.case_id
 left join lateral(select s.limit_hours,s.warning_hours from public.material_limit_versions s where s.material_id=m.id and s.effective_from<=(date_trunc('month',p_to)+interval '1 month - 1 day')::date order by s.effective_from desc,s.created_at desc limit 1) standard on true
 where r.equipment_id=p_equipment and r.cancelled_at is null and
 case when c.tracking_only then u.is_installed and i.performed_on is not null else u.installed_at is not null end
 and date_trunc('month',case when c.tracking_only then i.performed_on else (u.installed_at at time zone 'Asia/Bangkok')::date end)::date<=p_to
 order by m.id,case when c.tracking_only then i.performed_on else (u.installed_at at time zone 'Asia/Bangkok')::date end desc,u.id
 ), totals as(
 select l.*,date_trunc('month',l.performed_on)::date start_month,a.hours,a.missing from latest l left join lateral(
 select sum(h.operating_hours) hours,count(*) filter(where h.id is null)::integer missing
 from generate_series(date_trunc('month',l.performed_on),p_to::timestamp,interval '1 month') s(month)
 left join public.monthly_operating_hours h on h.equipment_id=p_equipment and h.month=s.month::date
 ) a on true
 )
 select t.id,t.code,t.name,t.unit,t.usage_id,t.case_id,t.case_code,t.order_code,t."position",t.performed_on,t.start_month,p_to,t.hours,t.missing,
 t.service_limit_hours,case when t.missing=0 then t.service_limit_hours-t.hours end,
 case when t.missing>0 then 'incomplete' when t.service_limit_hours is null then 'no_limit'
 when t.hours>=t.service_limit_hours then 'overdue' when t.hours>=t.service_limit_hours-t.service_warning_hours then 'due_soon' else 'normal' end from totals t;
end;$$;

revoke execute on function public.report_material_hours(uuid,date) from public,anon;
grant execute on function public.report_material_hours(uuid,date) to authenticated;
comment on table public.material_limit_versions is 'Các phiên bản định mức theo ngày hiệu lực; không sửa/xóa bản đã ban hành.';

commit;

