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
 return <><div className="catalog-simple-heading"><h1>Danh mục PTTB</h1><WorkspaceSelect workspaces={c.workspaces} selected={c.workspace.id}/></div>
  <div className="data-workbench equipment-catalog-workbench" aria-label="Khu vực nhập liệu và danh sách phương tiện">
   <div className="data-workbench-entry" id="them-phuong-tien">
    {p.edit && !selected && <p role="alert">Không tìm thấy phương tiện được phép sửa trong khu vực này. Hãy chọn lại từ danh sách.</p>}
    {canEdit?(p.edit&&!selected?<section className="panel"><h2>Không thể mở dữ liệu chỉnh sửa</h2><p>Hãy chọn lại phương tiện trong bảng bên dưới.</p></section>:<EquipmentEditor key={selected?.id??"new"} workspace={c.workspace.id} equipment={selected}/>):<section className="panel"><h2>Quyền xem danh mục</h2><p>Bạn được xem phương tiện trong khu vực này. Chỉ người quản lý khu vực được thêm hoặc sửa thông tin.</p></section>}
   </div>
   <EquipmentCatalogDirectory workspace={c.workspace.id} equipment={equipment} canEdit={canEdit}/>
  </div>
  <TableImportPanel workspace={c.workspace.id} kind="equipment" canImport={canEdit} defaultOpen={p.import==="equipment"}/>
  <p className="muted catalog-safety-note">Không xóa cứng phương tiện đã có lịch sử. Khi không còn khai thác, mở “Sửa” và chọn “Ngừng sử dụng” để giữ nguyên hồ sơ, vật tư và số liệu trước đây.</p></>;
}


