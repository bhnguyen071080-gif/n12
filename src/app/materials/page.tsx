import {context} from "@/lib/supabase";
import {WorkspaceSelect} from "@/components/workspace-select";
import {formatNumber} from "@/lib/domain";
import {cargoUnitLabels} from "@/lib/table-import";
import {canImportTable} from "@/lib/import-placement";
import {TableImportPanel} from "@/components/table-import-panel";
export const dynamic="force-dynamic";
export default async function Materials({searchParams}:{searchParams:Promise<{workspace?:string;import?:string}>}){
 const p=await searchParams,c=await context(p.workspace);if(!c.workspace)return <p>Chưa có quyền ở khu vực dữ liệu này.</p>;
 const w=c.workspace.id,[materials,cargo,memberships]=await Promise.all([c.client.from("materials").select("*").eq("workspace_id",w).order("code"),c.client.from("cargo_types").select("*").eq("workspace_id",w).order("code"),c.client.from("workspace_memberships").select("role").eq("workspace_id",w).eq("user_id",c.user.id).eq("active",true)]);
 if(materials.error||cargo.error||memberships.error)throw Error("Không đọc được danh mục hoặc quyền nhập.");
 const roles=memberships.data.map(m=>m.role);
 return <><h1>Danh mục vật tư & loại hàng</h1><WorkspaceSelect workspaces={c.workspaces} selected={w}/>
  <section className="panel"><div className="section-heading"><h2>Vật tư · {materials.data.length} mã</h2></div><p>Danh mục không phải tồn kho. Nhập mẫu không tạo phiếu kho hoặc thay định mức đã có.</p><div className="overflow-x-auto"><table><thead><tr><th>Mã vật tư</th><th>Tên vật tư</th><th>Đơn vị</th><th>Định mức giờ</th></tr></thead><tbody>{materials.data.map(m=><tr key={m.id}><td>{m.code}</td><td>{m.name}</td><td>{m.unit}</td><td>{formatNumber(m.service_limit_hours)}</td></tr>)}</tbody></table></div>{!materials.data.length&&<p>Chưa khai báo vật tư.</p>}</section>
  <TableImportPanel workspace={w} kind="materials" canImport={canImportTable(roles,"materials")} defaultOpen={p.import==="materials"}/>
  <section className="panel"><div className="section-heading"><h2>Loại hàng · {cargo.data.length} mã</h2></div><p>Khai báo đơn vị từng loại trước khi nhập sản lượng hàng khác; không cộng các đơn vị khác nhau.</p><div className="overflow-x-auto"><table><thead><tr><th>Mã loại hàng</th><th>Tên loại hàng</th><th>Đơn vị</th></tr></thead><tbody>{cargo.data.map(m=><tr key={m.id}><td>{m.code}</td><td>{m.name}</td><td>{cargoUnitLabels[m.unit]??m.unit}</td></tr>)}</tbody></table></div>{!cargo.data.length&&<p>Chưa khai báo loại hàng.</p>}</section>
  <TableImportPanel workspace={w} kind="cargo" canImport={canImportTable(roles,"cargo")} defaultOpen={p.import==="cargo"}/>
 </>;
}
