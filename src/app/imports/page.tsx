import Link from "next/link";
import {context} from "@/lib/supabase";
import {importKinds,importSpecs,type ImportKind} from "@/lib/table-import";
import {WorkspaceSelect} from "@/components/workspace-select";
import {TableImporter} from "@/components/table-importer";
export const dynamic="force-dynamic";
export default async function Imports({searchParams}:{searchParams:Promise<{workspace?:string;kind?:string}>}){
 const p=await searchParams,c=await context(p.workspace);if(!c.workspace)return <p>Chưa có quyền ở khu vực dữ liệu này.</p>;
 const w=c.workspace.id,kind=importKinds.includes(p.kind as ImportKind)?p.kind as ImportKind:"equipment";
 const membership=await c.client.from("workspace_memberships").select("role").eq("workspace_id",w).eq("user_id",c.user.id).eq("active",true);
 if(membership.error)throw Error("Không đọc được quyền nhập dữ liệu.");const roles=membership.data.map(m=>m.role),head=roles.includes("TRUONG_BO_PHAN_KY_THUAT");
 const canImport=head||(kind==="materials"&&roles.includes("CAN_BO_VAT_TU"))||(["hours","container","other"].includes(kind)&&roles.includes("KY_THUAT_VIEN"));
 return <><h1>Nhập dữ liệu từ bảng</h1><WorkspaceSelect workspaces={c.workspaces} selected={w}/><p>Tải mẫu, điền trong Excel, chọn tệp rồi kiểm tra trước khi xác nhận. Giữ ba bảng tháng độc lập.</p>
  <nav className="flex flex-wrap gap-3" aria-label="Chọn nhóm dữ liệu nhập">{importKinds.map(k=><Link key={k} className="button button-secondary" aria-current={kind===k?"page":undefined} href={"/imports?workspace="+w+"&kind="+k}>{importSpecs[k].title}</Link>)}</nav>
  <TableImporter key={w+kind} workspace={w} kind={kind} canImport={canImport}/>
 </>;
}
