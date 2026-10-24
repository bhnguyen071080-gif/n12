begin;
create function private.validate_hour_range(p_equipment uuid,p_from date,p_to date)
returns void language plpgsql stable set search_path='' as $$
begin
 if not private.can_equipment(p_equipment,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then raise exception using errcode='42501',message='Không có quyền xem giờ'; end if;
 if p_from is null or p_to is null or extract(day from p_from)<>1 or extract(day from p_to)<>1 or p_from<date '2000-01-01'
 or p_to<p_from or p_to>p_from+interval '49 years 11 months' then raise exception using errcode='22023',message='Khoảng tháng không hợp lệ'; end if;
end; $$;
create function public.report_operating_hours(p_equipment uuid,p_from date,p_to date)
returns table(month date,operating_hours numeric) language plpgsql stable security invoker set search_path='' as $$
begin
 perform private.validate_hour_range(p_equipment,p_from,p_to);
 return query select s.month::date,h.operating_hours from generate_series(p_from::timestamp,p_to::timestamp,interval '1 month') s(month)
 left join public.monthly_operating_hours h on h.equipment_id=p_equipment and h.month=s.month::date order by s.month;
end; $$;
create function public.report_material_hours(p_equipment uuid,p_to date)
returns table(material_id uuid,material_code text,material_name text,unit text,usage_id uuid,case_id uuid,case_code text,order_code text,"position" text,
 performed_on date,from_month date,to_month date,recorded_hours numeric,missing_months integer,limit_hours numeric,remaining_hours numeric,alert_level text)
language plpgsql stable security invoker set search_path='' as $$
begin
 perform private.validate_hour_range(p_equipment,p_to,p_to);
 return query with latest as(
 select distinct on(m.id) m.id,m.code,m.name,m.unit,u.id usage_id,c.id case_id,c.code case_code,r.code order_code,u.installation_position as "position",
 case when c.tracking_only then i.performed_on else (u.installed_at at time zone 'Asia/Bangkok')::date end performed_on,m.service_limit_hours,m.service_warning_hours
 from public.repair_material_usages u join public.materials m on m.id=u.material_id join public.repair_work_items i on i.id=u.repair_work_item_id
 join public.repair_orders r on r.id=i.repair_order_id left join public.work_cases c on c.id=r.case_id
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
end; $$;
revoke execute on function private.validate_hour_range(uuid,date,date),public.report_operating_hours(uuid,date,date),public.report_material_hours(uuid,date) from public,anon;
grant execute on function private.validate_hour_range(uuid,date,date),public.report_operating_hours(uuid,date,date),public.report_material_hours(uuid,date) to authenticated;
commit;
