begin;
create table public.sheet_sources(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id),
 name text not null,spreadsheet_id text not null check(spreadsheet_id ~ '^[A-Za-z0-9_-]{20,150}$'),
 tab_name text not null default 'TH',a1_range text not null default 'A3:BH76' check(a1_range ~ '^[A-Z]{1,2}[1-9][0-9]{0,3}:[A-Z]{1,2}[1-9][0-9]{0,3}$'),
 equipment_aliases jsonb not null default '{}' check(jsonb_typeof(equipment_aliases)='object'),
 created_by uuid not null default auth.uid() references auth.users(id),created_at timestamptz not null default now(),
 unique(workspace_id,spreadsheet_id,tab_name)
);
create table public.sheet_sync_runs(
 id uuid primary key default gen_random_uuid(),source_id uuid not null references public.sheet_sources(id),
 workspace_id uuid not null references public.workspaces(id),request_key uuid not null unique,
 actor_id uuid not null references auth.users(id),fingerprint text not null,accepted_rows jsonb not null,
 row_count integer not null check(row_count between 1 and 10000),created_at timestamptz not null default now()
);
create index sources_workspace_idx on public.sheet_sources(workspace_id);
create index sync_runs_source_time_idx on public.sheet_sync_runs(source_id,created_at desc);
alter table public.sheet_sources enable row level security;
alter table public.sheet_sync_runs enable row level security;
revoke all on public.sheet_sources,public.sheet_sync_runs from public,anon,authenticated;
grant select on public.sheet_sources,public.sheet_sync_runs to authenticated;
grant insert,update on public.sheet_sources to authenticated;
create policy source_read on public.sheet_sources for select to authenticated using(
 private.has_role(workspace_id,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]));
create policy source_create on public.sheet_sources for insert to authenticated with check(
 private.has_role(workspace_id,array['TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) and created_by=auth.uid());
create policy source_update on public.sheet_sources for update to authenticated using(
 private.has_role(workspace_id,array['TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[])) with check(
 private.has_role(workspace_id,array['TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]));
create policy sync_read on public.sheet_sync_runs for select to authenticated using(
 private.has_role(workspace_id,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]));
create function private.guard_source() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then new.created_by:=auth.uid();
 elsif row(new.id,new.workspace_id,new.created_by,new.created_at) is distinct from row(old.id,old.workspace_id,old.created_by,old.created_at) then
  raise exception using errcode='42501',message='Không được chuyển định danh nguồn'; end if;
 return new;
end; $$;
create trigger source_guard before insert or update on public.sheet_sources for each row execute function private.guard_source();
create trigger audit_row after insert or update on public.sheet_sources for each row execute function private.audit_change();
create trigger audit_row after insert on public.sheet_sync_runs for each row execute function private.audit_change();
create function private.sync_container_source(p_source uuid,p_rows jsonb,p_key uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare src public.sheet_sources; prior public.sheet_sync_runs; fp text; chunk jsonb; n integer; off integer; chunk_key uuid;
begin
 select * into strict src from public.sheet_sources where id=p_source for update;
 if not private.has_role(src.workspace_id,array['KY_THUAT_VIEN','TRUONG_BO_PHAN_KY_THUAT']::public.eam_role[]) then
  raise exception using errcode='42501',message='Không có quyền cập nhật nguồn'; end if;
 if p_rows is null or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 10000 or p_key is null then
  raise exception using errcode='22023',message='Nguồn phải có 1–10.000 dòng'; end if;
 fp:=md5(p_rows::text);
 select * into prior from public.sheet_sync_runs where request_key=p_key;
 if found then
  if prior.source_id<>p_source or prior.actor_id<>auth.uid() or prior.fingerprint<>fp then
   raise exception using errcode='22023',message='Khóa cập nhật đã dùng cho dữ liệu khác'; end if;return prior.row_count;
 end if;
 if exists(select 1 from jsonb_to_recordset(p_rows) as r(equipment_code text,month date)
 group by equipment_code,month having count(*)>1) then raise exception using errcode='22023',message='Trùng dòng phương tiện/tháng trong nguồn'; end if;
 n:=jsonb_array_length(p_rows);off:=0;
 while off<n loop
  select jsonb_agg(value order by ordinality) into chunk from jsonb_array_elements(p_rows) with ordinality
   where ordinality>off and ordinality<=off+1000;
  chunk_key:=md5(p_key::text||':'||off)::uuid;
  perform private.import_split(src.workspace_id,'container',chunk,chunk_key);
  off:=off+1000;
 end loop;
 insert into public.sheet_sync_runs(source_id,workspace_id,request_key,actor_id,fingerprint,accepted_rows,row_count)
 values(p_source,src.workspace_id,p_key,auth.uid(),fp,p_rows,n);
 return n;
end; $$;
create function public.sync_container_source(p_source uuid,p_rows jsonb,p_key uuid)
returns integer language sql security invoker set search_path='' as $$select private.sync_container_source(p_source,p_rows,p_key)$$;
revoke execute on function private.sync_container_source(uuid,jsonb,uuid),public.sync_container_source(uuid,jsonb,uuid) from public,anon;
grant execute on function private.sync_container_source(uuid,jsonb,uuid),public.sync_container_source(uuid,jsonb,uuid) to authenticated;
commit;
