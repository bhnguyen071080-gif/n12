begin;

create table public.equipment_history_entries (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 equipment_id uuid not null references public.equipment(id),
 performed_on date not null,
 content text not null check(length(btrim(content))>0),
 notes text not null default '',
 source_file_id text not null,
 source_sheet text not null,
 source_row integer not null check(source_row>0),
 source_key text not null,
 imported_at timestamptz not null default now(),
 unique(workspace_id,source_file_id,source_sheet,source_key)
);

create index equipment_history_entries_equipment_day_idx on public.equipment_history_entries(equipment_id,performed_on);
alter table public.equipment_history_entries enable row level security;
revoke all on public.equipment_history_entries from public,anon,authenticated;
grant select on public.equipment_history_entries to authenticated;
create policy equipment_history_entries_read on public.equipment_history_entries for select to authenticated using(
 private.can_equipment(equipment_id,array['KY_THUAT_VIEN','CAN_BO_VAT_TU','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[])
);

create or replace function private.validate_equipment_history_entry()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.equipment e where e.id=new.equipment_id and e.workspace_id=new.workspace_id) then
  raise exception using errcode='22023',message='Phương tiện không thuộc workspace';
 end if;
 new.content:=btrim(new.content);new.notes:=btrim(new.notes);
 return new;
end; $$;
revoke execute on function private.validate_equipment_history_entry() from public,anon,authenticated;
create trigger equipment_history_entry_guard before insert or update on public.equipment_history_entries
for each row execute function private.validate_equipment_history_entry();

create or replace view public.vw_equipment_history with(security_invoker=true) as
with base as (
 select c.id::text as event_key,c.equipment_id,c.code as case_code,c.kind::text as event_type,
 c.actual_started_at as event_at,c.actual_ended_at,c.summary as title,r.id as order_id,r.code as order_code
 from public.work_cases c left join public.repair_orders r on r.case_id=c.id
 union all
 select 'repair:'||r.id,r.equipment_id,null,'repair',r.opened_at,r.closed_at,r.title,r.id,r.code
 from public.repair_orders r where r.case_id is null
), current_history as (
 select b.*,
 coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'performed_on',i.performed_on,'symptom',i.symptom,'root_cause',i.root_cause,
 'solution_plan',i.solution_plan,'execution_result',i.execution_result,
 'basis_status',i.basis_status,'material_status',i.material_status,'requisition_status',i.requisition_status,
 'execution_status',i.execution_status,'acceptance_status',i.acceptance_status,'dossier_status',i.dossier_status,
 'materials',(select coalesce(jsonb_agg(jsonb_build_object('code',m.code,'name',m.name,'quantity',u.quantity,
 'unit',m.unit,'installed_at',u.installed_at,'document_status',u.document_status,'position',u.installation_position,'supply_state',u.supply_state,
 'return_status',(select f.return_status from public.case_material_followups f where f.case_id=(select r.case_id from public.repair_orders r where r.id=b.order_id)),
 'return_completed_at',(select f.completed_at from public.case_material_followups f where f.case_id=(select r.case_id from public.repair_orders r where r.id=b.order_id)))),'[]'::jsonb)
 from public.repair_material_usages u join public.materials m on m.id=u.material_id where u.repair_work_item_id=i.id)
 ) order by i.item_no) from public.repair_work_items i where i.repair_order_id=b.order_id),'[]'::jsonb) as work_items,
 coalesce((select sum(extract(epoch from upper(s.r)-lower(s.r))/3600)
 from (select unnest(range_agg(tstzrange(d.started_at,coalesce(d.ended_at,now()),'[)'))) as r
 from public.equipment_downtimes d where d.repair_order_id=b.order_id) s),0) as downtime_hours
 from base b
)
select * from current_history
union all
select 'legacy:'||h.id::text,h.equipment_id,null::text,'legacy'::text,
 (h.performed_on::timestamp at time zone 'Asia/Bangkok'),null::timestamptz,h.content,null::uuid,null::text,
 jsonb_build_array(jsonb_build_object('id',h.id,'performed_on',h.performed_on,'symptom',h.content||case when h.notes<>'' then E'\nGhi chú: '||h.notes else '' end,
 'root_cause','','solution_plan','','execution_result','','materials','[]'::jsonb)),0::numeric
from public.equipment_history_entries h;

revoke all on public.vw_equipment_history from public,anon;
grant select on public.vw_equipment_history to authenticated;

commit;

