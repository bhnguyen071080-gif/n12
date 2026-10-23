begin;
create or replace function public.report_workspace_material_hours(p_workspace uuid,p_to date)
returns table(equipment_id uuid,equipment_code text,material_id uuid,material_code text,material_name text,unit text,usage_id uuid,case_id uuid,case_code text,order_code text,"position" text,performed_on date,from_month date,to_month date,recorded_hours numeric,missing_months integer,limit_hours numeric,remaining_hours numeric,alert_level text)
language sql stable security invoker set search_path='' as $$
 select e.id,e.code,r.* from public.equipment e
 cross join lateral public.report_material_hours(e.id,p_to) r
 where e.workspace_id=p_workspace and private.can_equipment(e.id,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[])
 order by case r.alert_level when 'overdue' then 0 when 'due_soon' then 1 when 'incomplete' then 2 else 3 end,e.code,r.material_code
$$;
revoke execute on function public.report_workspace_material_hours(uuid,date) from public,anon;
grant execute on function public.report_workspace_material_hours(uuid,date) to authenticated;
commit;
