begin;
alter table public.repair_work_items add column if not exists work_duration_minutes integer not null default 0 check(work_duration_minutes between 0 and 43200);

create or replace function private.save_tracking_item_v2(p_order uuid,p_item uuid,p_version integer,p_data jsonb,p_minutes integer,p_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare iid uuid;
begin
 if p_minutes is null or p_minutes<0 or p_minutes>43200 then raise exception using errcode='22023',message='Thời lượng không hợp lệ';end if;
 iid:=private.save_tracking_item(p_order,p_item,p_version,p_data,p_key);
 update public.repair_work_items set work_duration_minutes=p_minutes where id=iid;
 return iid;
end;$$;
create or replace function public.save_tracking_item_v2(p_order uuid,p_item uuid,p_version integer,p_data jsonb,p_minutes integer,p_key uuid)
returns uuid language sql security invoker set search_path='' as $$select private.save_tracking_item_v2(p_order,p_item,p_version,p_data,p_minutes,p_key)$$;
revoke execute on function private.save_tracking_item_v2(uuid,uuid,integer,jsonb,integer,uuid),public.save_tracking_item_v2(uuid,uuid,integer,jsonb,integer,uuid) from public,anon;
grant execute on function private.save_tracking_item_v2(uuid,uuid,integer,jsonb,integer,uuid),public.save_tracking_item_v2(uuid,uuid,integer,jsonb,integer,uuid) to authenticated;

create or replace function public.report_work_hours(p_workspace uuid,p_from date,p_to date)
returns table(equipment_id uuid,equipment_code text,repair_hours numeric,maintenance_hours numeric,replacement_hours numeric,repair_events bigint,maintenance_events bigint)
language sql stable security invoker set search_path='' as $$
 with allowed as(select e.id,e.code from public.equipment e where e.workspace_id=p_workspace and private.can_equipment(e.id,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[])),
 work as(select e.id,e.code,c.id case_id,c.kind,i.id item_id,coalesce(i.work_duration_minutes,0) minutes,
  exists(select 1 from public.repair_material_usages u where u.repair_work_item_id=i.id and u.is_installed) replacement
  from allowed e left join public.work_cases c on c.equipment_id=e.id and c.actual_started_at>=p_from::timestamp at time zone 'Asia/Bangkok' and c.actual_started_at<p_to::timestamp at time zone 'Asia/Bangkok'
  left join public.repair_orders r on r.case_id=c.id left join public.repair_work_items i on i.repair_order_id=r.id)
 select id,code,coalesce(sum(minutes) filter(where kind='repair'),0)/60.0,coalesce(sum(minutes) filter(where kind='maintenance'),0)/60.0,
 coalesce(sum(minutes) filter(where replacement),0)/60.0,count(distinct case_id) filter(where kind='repair'),count(distinct case_id) filter(where kind='maintenance')
 from work group by id,code order by code
$$;
revoke execute on function public.report_work_hours(uuid,date,date) from public,anon;
grant execute on function public.report_work_hours(uuid,date,date) to authenticated;
commit;
