import Link from "next/link";
import {context} from "@/lib/supabase";
import {equipmentSchema,uuid} from "@/lib/domain";
import {WorkspaceSelect} from "@/components/workspace-select";
import {EquipmentEditor} from "@/components/equipment-editor";
import {EquipmentCatalogDirectory} from "@/components/equipment-catalog-directory";
import {TableImportPanel} from "@/components/table-import-panel";
export const dynamic="force-dynamic";
export default async function Catalog({searchParams}:{searchParams:Promise<{workspace?:string;edit?:string;import?:string;add?:string}>}){
 const p=await searchParams,c=await context(p.workspace);
 if(!c.workspace)return <><h1>Danh mục phương tiện</h1><p>Chưa được cấp khu vực dữ liệu này.</p></>;
 const [rows,memberships]=await Promise.all([c.client.from("equipment").select("*").eq("workspace_id",c.workspace.id).order("code"),c.client.from("workspace_memberships").select("role,active").eq("workspace_id",c.workspace.id).eq("user_id",c.user.id).eq("active",true)]);
 if(rows.error || memberships.error)throw new Error("Không đọc được danh mục hoặc quyền quản lý.");
 const equipment=equipmentSchema.array().parse(rows.data),canEdit=memberships.data.some(r=>r.role==="TRUONG_BO_PHAN_KY_THUAT");
 const selected=p.edit && uuid.safeParse(p.edit).success?equipment.find(e=>e.id===p.edit):undefined;
 const base="/catalog?workspace="+c.workspace.id;
 return <><div className="catalog-heading"><div><p className="eyebrow">BƯỚC 1 · THÔNG TIN GỐC</p><h1>Danh mục phương tiện</h1><p className="muted">{c.workspace.name} · quản lý thống nhất theo tên đầy đủ và mã gõ tắt</p></div><div className="catalog-heading-actions"><Link className="button button-secondary" href={"/?workspace="+c.workspace.id}>Về tổng quan</Link></div></div><WorkspaceSelect workspaces={c.workspaces} selected={c.workspace.id}/>
  <div className="data-workbench" aria-label="Khu vực nhập liệu và danh sách phương tiện">
   <div className="data-workbench-entry" id="them-phuong-tien">
    {p.edit && !selected && <p role="alert">Không tìm thấy phương tiện được phép sửa trong khu vực này. Hãy chọn lại từ danh sách.</p>}
    {canEdit?(p.edit&&!selected?<section className="panel"><h2>Không thể mở dữ liệu chỉnh sửa</h2><p><Link href={base}>Trở về chế độ thêm mới</Link></p></section>:<EquipmentEditor key={selected?.id??"new"} workspace={c.workspace.id} equipment={selected}/>):<section className="panel"><h2>Quyền xem danh mục</h2><p>Bạn được xem phương tiện trong khu vực này. Chỉ người quản lý khu vực được thêm hoặc sửa thông tin.</p></section>}
    <TableImportPanel workspace={c.workspace.id} kind="equipment" canImport={canEdit} defaultOpen={p.import==="equipment"}/>
   </div>
   <EquipmentCatalogDirectory workspace={c.workspace.id} equipment={equipment} canEdit={canEdit}/>
  </div>
  <p className="muted">Không xóa cứng phương tiện đã có lịch sử. Khi không còn khai thác, chọn “Ngừng sử dụng” trong Chỉnh sửa để vẫn giữ nguyên hồ sơ, vật tư và số liệu trước đây.</p></>;
}

