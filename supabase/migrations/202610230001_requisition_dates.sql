-- Separate the maintenance-plan date from the date printed on each requisition.
begin;

alter table public.maintenance_requisition_runs
 add column if not exists document_day date;
alter table public.maintenance_requisition_runs
 add column if not exists voucher_kind text not null default 'planned';
alter table public.maintenance_requisition_runs
 add column if not exists supplement_note text;

update public.maintenance_requisition_runs
 set document_day=planned_day
 where document_day is null;

alter table public.maintenance_requisition_runs
 alter column document_day set not null;
alter table public.maintenance_requisition_runs
 drop constraint if exists maintenance_requisition_voucher_kind_valid;
alter table public.maintenance_requisition_runs
 add constraint maintenance_requisition_voucher_kind_valid
 check(voucher_kind in ('planned','supplemental'));
alter table public.maintenance_requisition_runs
 drop constraint if exists maintenance_requisition_supplement_note_valid;
alter table public.maintenance_requisition_runs
 add constraint maintenance_requisition_supplement_note_valid check(
  (voucher_kind='planned' and supplement_note is null) or
  (voucher_kind='supplemental' and length(btrim(supplement_note)) between 3 and 500));

create or replace function private.save_maintenance_requisition_v3(
 p_workspace uuid,
 p_planned_day date,
 p_document_day date,
 p_voucher_kind text,
 p_supplement_note text,
 p_grouping text,
 p_rows jsonb,
 p_print jsonb,
 p_source_filename text,
 p_source_sha256 text,
 p_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid; clean_note text; print_snapshot jsonb;
begin
 if p_document_day is null or p_voucher_kind not in ('planned','supplemental') then
  raise exception using errcode='22023',message='Sai ngày hoặc loại phiếu lĩnh';
 end if;
 clean_note:=nullif(btrim(p_supplement_note),'');
 if (p_voucher_kind='planned' and clean_note is not null) or
    (p_voucher_kind='supplemental' and (clean_note is null or length(clean_note) not between 3 and 500)) then
  raise exception using errcode='22023',message='Sai lý do phiếu bổ sung';
 end if;
 print_snapshot:=p_print||jsonb_build_object(
  'documentDay',p_document_day::text,
  'voucherKind',p_voucher_kind,
  'supplementNote',coalesce(clean_note,''));
 rid:=private.save_maintenance_requisition_v2(
  p_workspace,p_planned_day,p_grouping,p_rows,print_snapshot,
  p_source_filename,p_source_sha256,p_key);
 update public.maintenance_requisition_runs
  set document_day=p_document_day,voucher_kind=p_voucher_kind,supplement_note=clean_note
  where id=rid and workspace_id=p_workspace and created_by=auth.uid();
 if not found then
  raise exception using errcode='42501',message='Không được cập nhật ngày phiếu lĩnh';
 end if;
 return rid;
end;$$;

create or replace function public.save_maintenance_requisition_v3(
 p_workspace uuid,
 p_planned_day date,
 p_document_day date,
 p_voucher_kind text,
 p_supplement_note text,
 p_grouping text,
 p_rows jsonb,
 p_print jsonb,
 p_source_filename text,
 p_source_sha256 text,
 p_key uuid)
returns uuid language sql security invoker set search_path='' as $$
 select private.save_maintenance_requisition_v3(
  p_workspace,p_planned_day,p_document_day,p_voucher_kind,p_supplement_note,
  p_grouping,p_rows,p_print,p_source_filename,p_source_sha256,p_key)
$$;

revoke execute on function private.save_maintenance_requisition_v3(uuid,date,date,text,text,text,jsonb,jsonb,text,text,uuid) from public,anon;
revoke execute on function public.save_maintenance_requisition_v3(uuid,date,date,text,text,text,jsonb,jsonb,text,text,uuid) from public,anon;
grant execute on function private.save_maintenance_requisition_v3(uuid,date,date,text,text,text,jsonb,jsonb,text,text,uuid) to authenticated;
grant execute on function public.save_maintenance_requisition_v3(uuid,date,date,text,text,text,jsonb,jsonb,text,text,uuid) to authenticated;

comment on column public.maintenance_requisition_runs.planned_day is 'Ngày công việc theo kế hoạch bảo dưỡng; dùng để liên kết vụ việc.';
comment on column public.maintenance_requisition_runs.document_day is 'Ngày lập phiếu lĩnh thực tế và ngày in trên chứng từ.';
comment on column public.maintenance_requisition_runs.voucher_kind is 'Phiếu theo kế hoạch hoặc phiếu bổ sung phát sinh.';

commit;

