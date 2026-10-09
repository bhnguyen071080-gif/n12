import {context} from "@/lib/supabase";
import {WorkspaceSelect} from "@/components/workspace-select";
import {SheetEntry} from "@/components/sheet-entry";
export const dynamic="force-dynamic";
export default async function Sheets({searchParams}:{searchParams:Promise<{workspace?:string}>}){
 const p=await searchParams,c=await context(p.workspace);if(!c.workspace)return <p>Chưa có workspace.</p>;
 const [sources,runs]=await Promise.all([c.client.from("sheet_sources").select("id,name").eq("workspace_id",c.workspace.id),
 c.client.from("sheet_sync_runs").select("id,row_count,created_at").eq("workspace_id",c.workspace.id).order("created_at",{ascending:false}).limit(20)]);
 if(sources.error || runs.error)return <p>Chưa có quyền nguồn hoặc chưa áp dụng migration nguồn Sheets.</p>;
 return <><h1>Nguồn Google Sheets · Container (chiếc)</h1><WorkspaceSelect workspaces={c.workspaces} selected={c.workspace.id}/><SheetEntry workspace={c.workspace.id} sources={sources.data??[]}/>
 <section className="panel"><h2>Lịch sử cập nhật</h2>{runs.data?.map(r=><p key={r.id}>{new Date(r.created_at).toLocaleString("vi-VN",{timeZone:"Asia/Bangkok"})}: {r.row_count} dòng. Bản chụp lô nằm trong database cloud.</p>)}</section></>;
}
