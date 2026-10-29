-- Focused read paths for the three slow online task flows.  Each private
-- function validates workspace access once, then performs a scoped set query
-- without invoking row-level helper functions for every returned row.
begin;

create index if not exists equipment_history_entries_workspace_day_equipment_idx
 on public.equipment_history_entries(workspace_id,performed_on,equipment_id);
create index if not exists monthly_operating_hours_month_equipment_idx
 on public.monthly_operating_hours(month,equipment_id);

create function private.read_equipment_history_impl(
 p_workspace uuid,p_equipment uuid,p_from date,p_to date,
 p_after_event_at timestamptz,p_after_event_key text,p_limit integer
)
returns table(
 equipment_id uuid,event_key text,event_at timestamptz,case_code text,
 order_code text,title text,work_items jsonb
)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.has_role(p_workspace,array['KY_THUAT_VIEN','CAN_BO_VAT_TU','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then
  raise exception using errcode='42501',message='Không có quyền xem lý lịch phương tiện';
 end if;
 if p_from is null or p_to is null or p_from<date '2000-01-01' or p_to<p_from
  or p_to>p_from+interval '50 years' then
  raise exception using errcode='22023',message='Khoảng ngày lý lịch không hợp lệ';
 end if;
 if p_equipment is not null and not exists(
  select 1 from public.equipment e where e.id=p_equipment and e.workspace_id=p_workspace
 ) then
  raise exception using errcode='22023',message='Phương tiện không thuộc workspace';
 end if;
 if p_limit is null or p_limit<1 or p_limit>1000
  or (p_after_event_at is null)<>(p_after_event_key is null) then
  raise exception using errcode='22023',message='Con trỏ hoặc giới hạn lý lịch không hợp lệ';
 end if;

 return query
 with base as(
  select c.id::text as event_key,c.equipment_id,c.code as case_code,
   c.actual_started_at as event_at,c.summary as title,r.id as order_id,r.code as order_code
  from public.work_cases c
  join public.equipment e on e.id=c.equipment_id and e.workspace_id=p_workspace
  left join public.repair_orders r on r.case_id=c.id
  where (p_equipment is null or c.equipment_id=p_equipment)
   and c.actual_started_at>=p_from::timestamp at time zone 'Asia/Bangkok'
   and c.actual_started_at<(p_to+1)::timestamp at time zone 'Asia/Bangkok'
  union all
  select 'repair:'||r.id,r.equipment_id,null::text,r.opened_at,r.title,r.id,r.code
  from public.repair_orders r
  join public.equipment e on e.id=r.equipment_id and e.workspace_id=p_workspace
  where r.case_id is null and (p_equipment is null or r.equipment_id=p_equipment)
   and r.opened_at>=p_from::timestamp at time zone 'Asia/Bangkok'
   and r.opened_at<(p_to+1)::timestamp at time zone 'Asia/Bangkok'
 ), current_events as(
  select b.equipment_id,b.event_key,b.event_at,b.case_code,b.order_code,b.title,
   coalesce(items.work_items,'[]'::jsonb) as work_items
  from base b
  left join lateral(
   select jsonb_agg(jsonb_build_object(
    'id',i.id,'performed_on',i.performed_on,'symptom',i.symptom,
    'root_cause',i.root_cause,'solution_plan',i.solution_plan,
    'execution_result',i.execution_result
   ) order by i.item_no) as work_items
   from public.repair_work_items i where i.repair_order_id=b.order_id
  ) items on true
 ), legacy_events as(
  select h.equipment_id,'legacy:'||h.id::text as event_key,
   h.performed_on::timestamp at time zone 'Asia/Bangkok' as event_at,
   null::text as case_code,null::text as order_code,h.content as title,
   jsonb_build_array(jsonb_build_object(
    'id',h.id,'performed_on',h.performed_on,'symptom',
    h.content||case when h.notes<>'' then E'\nGhi chú: '||h.notes else '' end,
    'root_cause','','solution_plan','','execution_result',''
   )) as work_items
  from public.equipment_history_entries h
  where h.workspace_id=p_workspace and (p_equipment is null or h.equipment_id=p_equipment)
   and h.performed_on between p_from and p_to
 ), all_events as(
  select * from current_events union all select * from legacy_events
 )
 select a.equipment_id,a.event_key,a.event_at,a.case_code,a.order_code,a.title,a.work_items
 from all_events a
 where p_after_event_at is null
  or a.event_at>p_after_event_at
  or (a.event_at=p_after_event_at and a.event_key>p_after_event_key)
 order by a.event_at,a.event_key
 limit p_limit;
end;$$;

create function public.read_equipment_history(
 p_workspace uuid,p_equipment uuid default null,p_from date default date '2000-01-01',
 p_to date default current_date,p_after_event_at timestamptz default null,
 p_after_event_key text default null,p_limit integer default 1000
)
returns table(
 equipment_id uuid,event_key text,event_at timestamptz,case_code text,
 order_code text,title text,work_items jsonb
)
language sql stable security invoker set search_path='' as $$
 select * from private.read_equipment_history_impl(
  p_workspace,p_equipment,p_from,p_to,p_after_event_at,p_after_event_key,p_limit
 )
$$;

create function private.read_monthly_activity_impl(
 p_workspace uuid,p_from date,p_to date,p_group text,p_offset integer,p_limit integer
)
returns table(
 workspace_id uuid,equipment_id uuid,equipment_code text,month date,
 boxes bigint,operating_hours numeric,accumulated_hours numeric
)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.has_role(p_workspace,enum_range(null::public.eam_role)) then
  raise exception using errcode='42501',message='Không có quyền xem dữ liệu tháng';
 end if;
 if (p_from is not null and extract(day from p_from)<>1)
  or (p_to is not null and extract(day from p_to)<>1)
  or (p_from is not null and p_to is not null and p_to<p_from)
  or coalesce(p_offset,-1)<0 or p_limit is null or p_limit<1 or p_limit>1000 then
  raise exception using errcode='22023',message='Bộ lọc dữ liệu tháng không hợp lệ';
 end if;
 if p_group is not null and p_group<>'' and not exists(
  select 1 from public.equipment e where e.workspace_id=p_workspace and e.category=p_group
 ) then
  raise exception using errcode='22023',message='Nhóm phương tiện không hợp lệ';
 end if;

 return query
 with activity as(
  select coalesce(p.equipment_id,h.equipment_id) as equipment_id,
   coalesce(p.month,h.month) as month,p.boxes,h.operating_hours
  from (
   select mp.equipment_id,mp.month,mp.boxes from public.monthly_production mp
   where mp.cancelled_at is null and (p_from is null or mp.month>=p_from) and (p_to is null or mp.month<=p_to)
  ) p
  full join (
   select mh.equipment_id,mh.month,mh.operating_hours from public.monthly_operating_hours mh
   where (p_from is null or mh.month>=p_from) and (p_to is null or mh.month<=p_to)
  ) h using(equipment_id,month)
 )
 select e.workspace_id,e.id,e.code,a.month,a.boxes,a.operating_hours,e.accumulated_hours
 from activity a join public.equipment e on e.id=a.equipment_id
 where e.workspace_id=p_workspace and (p_group is null or p_group='' or e.category=p_group)
 order by a.month desc,e.code
 offset p_offset limit p_limit;
end;$$;

create function public.read_monthly_activity(
 p_workspace uuid,p_from date default null,p_to date default null,p_group text default null,
 p_offset integer default 0,p_limit integer default 1000
)
returns table(
 workspace_id uuid,equipment_id uuid,equipment_code text,month date,
 boxes bigint,operating_hours numeric,accumulated_hours numeric
)
language sql stable security invoker set search_path='' as $$
 select * from private.read_monthly_activity_impl(
  p_workspace,p_from,p_to,p_group,p_offset,p_limit
 )
$$;

create function private.report_workspace_material_alerts_impl(
 p_workspace uuid,p_to date,p_limit integer
)
returns table(
 equipment_id uuid,equipment_code text,material_id uuid,material_code text,material_name text,unit text,
 usage_id uuid,case_id uuid,case_code text,order_code text,"position" text,performed_on date,
 from_month date,to_month date,recorded_hours numeric,missing_months integer,limit_hours numeric,
 remaining_hours numeric,alert_level text
)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.has_role(p_workspace,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then
  raise exception using errcode='42501',message='Không có quyền xem cảnh báo vật tư';
 end if;
 if p_to is null or extract(day from p_to)<>1 or p_to<date '2000-01-01'
  or p_limit is null or p_limit<1 or p_limit>100 then
  raise exception using errcode='22023',message='Kỳ hoặc giới hạn cảnh báo không hợp lệ';
 end if;

 return query
 with latest as(
  select distinct on(r.equipment_id,m.id)
   e.id as equipment_id,e.code as equipment_code,m.id as material_id,m.code as material_code,
   m.name as material_name,m.unit,u.id as usage_id,c.id as case_id,c.code as case_code,
   r.code as order_code,u.installation_position as "position",
   case when c.tracking_only then i.performed_on else (u.installed_at at time zone 'Asia/Bangkok')::date end as performed_on,
   coalesce(standard.limit_hours,m.service_limit_hours) as limit_hours,
   coalesce(standard.warning_hours,m.service_warning_hours) as warning_hours
  from public.repair_material_usages u
  join public.materials m on m.id=u.material_id
  join public.repair_work_items i on i.id=u.repair_work_item_id
  join public.repair_orders r on r.id=i.repair_order_id and r.cancelled_at is null
  join public.equipment e on e.id=r.equipment_id and e.workspace_id=p_workspace
  left join public.work_cases c on c.id=r.case_id
  left join lateral(
   select s.limit_hours,s.warning_hours from public.material_limit_versions s
   where s.material_id=m.id
    and s.effective_from<=(date_trunc('month',p_to)+interval '1 month - 1 day')::date
   order by s.effective_from desc,s.created_at desc limit 1
  ) standard on true
  where case when c.tracking_only then u.is_installed and i.performed_on is not null else u.installed_at is not null end
   and date_trunc('month',case when c.tracking_only then i.performed_on else (u.installed_at at time zone 'Asia/Bangkok')::date end)::date<=p_to
  order by r.equipment_id,m.id,
   case when c.tracking_only then i.performed_on else (u.installed_at at time zone 'Asia/Bangkok')::date end desc,u.id
 ), totals as(
  select l.*,date_trunc('month',l.performed_on)::date as from_month,
   hours.recorded_hours,hours.missing_months
  from latest l
  left join lateral(
   select sum(h.operating_hours) as recorded_hours,
    ((extract(year from age(p_to,date_trunc('month',l.performed_on)::date))*12
      +extract(month from age(p_to,date_trunc('month',l.performed_on)::date))+1)::integer
      -count(h.id)::integer) as missing_months
   from public.monthly_operating_hours h
   where h.equipment_id=l.equipment_id
    and h.month between date_trunc('month',l.performed_on)::date and p_to
  ) hours on true
 ), alerts as(
  select t.*,
   case when t.missing_months=0 then t.limit_hours-t.recorded_hours end as remaining_hours,
   case when t.missing_months>0 then 'incomplete'
    when t.limit_hours is null then 'no_limit'
    when t.recorded_hours>=t.limit_hours then 'overdue'
    when t.recorded_hours>=t.limit_hours-t.warning_hours then 'due_soon'
    else 'normal' end as alert_level
  from totals t
 )
 select a.equipment_id,a.equipment_code,a.material_id,a.material_code,a.material_name,a.unit,
  a.usage_id,a.case_id,a.case_code,a.order_code,a."position",a.performed_on,a.from_month,p_to,
  a.recorded_hours,a.missing_months,a.limit_hours,a.remaining_hours,a.alert_level
 from alerts a where a.alert_level in('overdue','due_soon')
 order by case a.alert_level when 'overdue' then 0 else 1 end,a.equipment_code,a.material_code
 limit p_limit;
end;$$;

create function public.report_workspace_material_alerts(
 p_workspace uuid,p_to date,p_limit integer default 12
)
returns table(
 equipment_id uuid,equipment_code text,material_id uuid,material_code text,material_name text,unit text,
 usage_id uuid,case_id uuid,case_code text,order_code text,"position" text,performed_on date,
 from_month date,to_month date,recorded_hours numeric,missing_months integer,limit_hours numeric,
 remaining_hours numeric,alert_level text
)
language sql stable security invoker set search_path='' as $$
 select * from private.report_workspace_material_alerts_impl(p_workspace,p_to,p_limit)
$$;

revoke execute on function private.read_equipment_history_impl(uuid,uuid,date,date,timestamptz,text,integer) from public,anon;
revoke execute on function private.read_monthly_activity_impl(uuid,date,date,text,integer,integer) from public,anon;
revoke execute on function private.report_workspace_material_alerts_impl(uuid,date,integer) from public,anon;
grant execute on function private.read_equipment_history_impl(uuid,uuid,date,date,timestamptz,text,integer) to authenticated;
grant execute on function private.read_monthly_activity_impl(uuid,date,date,text,integer,integer) to authenticated;
grant execute on function private.report_workspace_material_alerts_impl(uuid,date,integer) to authenticated;

revoke execute on function public.read_equipment_history(uuid,uuid,date,date,timestamptz,text,integer) from public,anon;
revoke execute on function public.read_monthly_activity(uuid,date,date,text,integer,integer) from public,anon;
revoke execute on function public.report_workspace_material_alerts(uuid,date,integer) from public,anon;
grant execute on function public.read_equipment_history(uuid,uuid,date,date,timestamptz,text,integer) to authenticated;
grant execute on function public.read_monthly_activity(uuid,date,date,text,integer,integer) to authenticated;
grant execute on function public.report_workspace_material_alerts(uuid,date,integer) to authenticated;

comment on function public.read_equipment_history(uuid,uuid,date,date,timestamptz,text,integer)
 is 'Keyset-paginated, task-specific equipment history read path.';
comment on function public.read_monthly_activity(uuid,date,date,text,integer,integer)
 is 'Workspace-scoped monthly activity read path with one authorization check.';
comment on function public.report_workspace_material_alerts(uuid,date,integer)
 is 'Set-based dashboard alert query; returns only yellow and red rows.';

commit;
