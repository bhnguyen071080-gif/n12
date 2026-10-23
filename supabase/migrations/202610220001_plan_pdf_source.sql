-- Link the confirmed import to the local PDF without uploading its contents.
begin;
alter table public.maintenance_requisition_runs add column if not exists source_filename text;
alter table public.maintenance_requisition_runs add column if not exists source_sha256 text;
alter table public.maintenance_requisition_runs drop constraint if exists maintenance_requisition_source_valid;
alter table public.maintenance_requisition_runs add constraint maintenance_requisition_source_valid check(
 (source_filename is null and source_sha256 is null) or
 (length(btrim(source_filename)) between 1 and 255 and source_filename not like '%/%' and source_filename not like '%\%' and source_sha256 ~ '^[a-f0-9]{64}$'));

create or replace function private.save_maintenance_requisition_v2(p_workspace uuid,p_day date,p_grouping text,p_rows jsonb,p_print jsonb,p_source_filename text,p_source_sha256 text,p_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;
begin
 if p_source_filename is null or length(btrim(p_source_filename)) not between 1 and 255 or p_source_filename like '%/%' or p_source_filename like '%\%' or p_source_filename !~* '\.pdf$' or p_source_sha256 !~ '^[a-f0-9]{64}$' then raise exception using errcode='22023',message='Sai tệp PDF nguồn';end if;
 rid:=private.save_maintenance_requisition(p_workspace,p_day,p_grouping,p_rows,p_print,p_key);
 update public.maintenance_requisition_runs set source_filename=btrim(p_source_filename),source_sha256=p_source_sha256 where id=rid and workspace_id=p_workspace and created_by=auth.uid();
 if not found then raise exception using errcode='42501',message='Không được liên kết tệp nguồn';end if;return rid;
end;$$;
create or replace function public.save_maintenance_requisition_v2(p_workspace uuid,p_day date,p_grouping text,p_rows jsonb,p_print jsonb,p_source_filename text,p_source_sha256 text,p_key uuid)
returns uuid language sql security invoker set search_path='' as $$select private.save_maintenance_requisition_v2(p_workspace,p_day,p_grouping,p_rows,p_print,p_source_filename,p_source_sha256,p_key)$$;
revoke execute on function private.save_maintenance_requisition_v2(uuid,date,text,jsonb,jsonb,text,text,uuid),public.save_maintenance_requisition_v2(uuid,date,text,jsonb,jsonb,text,text,uuid) from public,anon;
grant execute on function private.save_maintenance_requisition_v2(uuid,date,text,jsonb,jsonb,text,text,uuid),public.save_maintenance_requisition_v2(uuid,date,text,jsonb,jsonb,text,text,uuid) to authenticated;
commit;
