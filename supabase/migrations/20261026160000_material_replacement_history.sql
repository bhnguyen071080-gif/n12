-- One auditable history source for every installed material. The current-life
-- report remains responsible for alerts; this report answers frequency and
-- traceability questions without duplicating entry screens.
begin;

create index if not exists repair_material_usages_installed_material_idx
 on public.repair_material_usages(material_id,installed_at desc)
 where is_installed;
create index if not exists repair_work_items_order_performed_idx
 on public.repair_work_items(repair_order_id,performed_on desc);

create function public.report_material_replacements(
 p_workspace uuid,p_from date,p_to date,p_equipment uuid default null,p_query text default '',p_limit integer default 500
)
returns table(
 equipment_id uuid,equipment_code text,equipment_name text,material_id uuid,material_code text,material_name text,unit text,
 usage_id uuid,quantity numeric,"position" text,replaced_on date,previous_replaced_on date,days_since_previous integer,
 case_id uuid,case_code text,order_code text,item_id uuid,total_count bigint
)
language plpgsql stable security invoker set search_path='' as $$
begin
 if not private.has_role(p_workspace,array['KY_THUAT_VIEN','CAN_BO_VAT_TU','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then
  raise exception using errcode='42501',message='Không có quyền xem lịch sử thay vật tư';
 end if;
 if p_from is null or p_to is null or p_from<date '2000-01-01' or p_to<p_from or p_to>p_from+interval '50 years' then
  raise exception using errcode='22023',message='Khoảng ngày thay vật tư không hợp lệ';
 end if;
 if p_equipment is not null and not exists(select 1 from public.equipment e where e.id=p_equipment and e.workspace_id=p_workspace) then
  raise exception using errcode='22023',message='Phương tiện không thuộc workspace';
 end if;
 if p_limit is null or p_limit<1 or p_limit>1000 then
  raise exception using errcode='22023',message='Giới hạn lịch sử phải từ 1 đến 1000';
 end if;

 return query with raw_rows as(
  select e.id equipment_id,e.code equipment_code,e.name equipment_name,m.id material_id,m.code material_code,m.name material_name,m.unit,
   u.id usage_id,u.quantity,u.installation_position as "position",
   case when c.tracking_only then i.performed_on else (u.installed_at at time zone 'Asia/Bangkok')::date end replaced_on,
   c.id case_id,c.code case_code,r.code order_code,i.id item_id
  from public.repair_material_usages u
  join public.materials m on m.id=u.material_id
  join public.repair_work_items i on i.id=u.repair_work_item_id
  join public.repair_orders r on r.id=i.repair_order_id
  join public.equipment e on e.id=r.equipment_id
  left join public.work_cases c on c.id=r.case_id
  where e.workspace_id=p_workspace and (p_equipment is null or e.id=p_equipment) and r.cancelled_at is null
   and case when c.tracking_only then u.is_installed and i.performed_on is not null else u.installed_at is not null end
 ), with_previous as(
  select x.*,lag(x.replaced_on) over(
   partition by x.equipment_id,x.material_id,lower(btrim(x."position")) order by x.replaced_on,x.usage_id
  ) previous_replaced_on
  from raw_rows x
 ), filtered as(
  select x.*,(x.replaced_on-x.previous_replaced_on)::integer days_since_previous
  from with_previous x
  where x.replaced_on between p_from and p_to
   and (btrim(coalesce(p_query,''))='' or lower(x.material_code||' '||x.material_name||' '||x.equipment_code||' '||x.equipment_name||' '||x."position")
    like '%'||lower(btrim(p_query))||'%')
 ), counted as(
  select x.*,count(*) over() total_count from filtered x
 )
 select x.equipment_id,x.equipment_code,x.equipment_name,x.material_id,x.material_code,x.material_name,x.unit,x.usage_id,x.quantity,x."position",
  x.replaced_on,x.previous_replaced_on,x.days_since_previous,x.case_id,x.case_code,x.order_code,x.item_id,x.total_count
 from counted x order by x.replaced_on desc,x.equipment_code,x.material_code limit p_limit;
end;$$;

revoke execute on function public.report_material_replacements(uuid,date,date,uuid,text,integer) from public,anon;
grant execute on function public.report_material_replacements(uuid,date,date,uuid,text,integer) to authenticated;
comment on function public.report_material_replacements(uuid,date,date,uuid,text,integer) is
 'Lịch sử mọi lần vật tư đã lắp, kèm lần thay trước để phân tích tần suất; tối đa 1000 dòng.';

commit;

