import {context} from "@/lib/supabase";
import {WorkspaceSelect} from "@/components/workspace-select";
import {canImportTable} from "@/lib/import-placement";
import {MaterialCatalog} from "@/components/material-catalog";
export const dynamic="force-dynamic";
export default async function Materials({searchParams}:{searchParams:Promise<{workspace?:string;import?:string}>}){
 const p=await searchParams,c=await context(p.workspace);if(!c.workspace)return <p>Chưa có quyền ở khu vực dữ liệu này.</p>;
 const w=c.workspace.id,[materials,memberships]=await Promise.all([c.client.from("materials").select("id,code,name,unit,equipment_category,service_limit_hours").eq("workspace_id",w).order("code"),c.client.from("workspace_memberships").select("role").eq("workspace_id",w).eq("user_id",c.user.id).eq("active",true)]);
 if(materials.error||memberships.error)throw Error("Không đọc được danh mục hoặc quyền nhập.");
 const roles=memberships.data.map(m=>m.role);
 return <><div className="catalog-heading"><div><p className="eyebrow">QUẢN LÝ VẬT TƯ</p><h1>Danh mục vật tư</h1><p className="muted">{c.workspace.name} · {materials.data.length} mã vật tư</p></div><WorkspaceSelect workspaces={c.workspaces} selected={w}/></div>
  <MaterialCatalog key={w} workspace={w} rows={materials.data} canEdit={canImportTable(roles,"materials")} openImport={p.import==="materials"}/>
 </>;
}
