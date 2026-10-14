import Link from "next/link";
import {context} from "@/lib/supabase";
import {equipmentSchema,statusLabels,uuid} from "@/lib/domain";
import {categoryLabels} from "@/lib/equipment-catalog";
import {WorkspaceSelect} from "@/components/workspace-select";
import {EquipmentEditor} from "@/components/equipment-editor";
export const dynamic="force-dynamic";
export default async function Catalog({searchParams}:{searchParams:Promise<{workspace?:string;edit?:string}>}){
 const p=await searchParams,c=await context(p.workspace);
 if(!c.workspace)return <><h1>Danh mục phương tiện</h1><p>Chưa được cấp khu vực dữ liệu này.</p></>;
 const [rows,memberships]=await Promise.all([c.client.from("equipment").select("*").eq("workspace_id",c.workspace.id).order("code"),c.client.from("workspace_memberships").select("role,active").eq("workspace_id",c.workspace.id).eq("user_id",c.user.id).eq("active",true)]);
 if(rows.error || memberships.error)throw new Error("Không đọc được danh mục hoặc quyền quản lý.");
 const equipment=equipmentSchema.array().parse(rows.data),canEdit=memberships.data.some(r=>r.role==="TRUONG_BO_PHAN_KY_THUAT");
 const selected=p.edit && uuid.safeParse(p.edit).success?equipment.find(e=>e.id===p.edit):undefined;
 const base="/catalog?workspace="+c.workspace.id;
 return <><div className="catalog-heading"><div><p className="eyebrow">BƯỚC 1 · THÔNG TIN GỐC</p><h1>Danh mục phương tiện</h1><p className="muted">{c.workspace.name} · {equipment.length} phương tiện</p></div><Link className="button button-secondary" href={"/?workspace="+c.workspace.id}>Về tổng quan</Link></div><WorkspaceSelect workspaces={c.workspaces} selected={c.workspace.id}/>
  <section className="panel overflow-x-auto"><div className="section-heading"><h2>Phương tiện đã khai báo</h2>{canEdit && <Link className="button" href={base+"#them-phuong-tien"}>Thêm phương tiện</Link>}</div>
   {equipment.length?<table><thead><tr><th>Mã / tên</th><th>Loại thiết bị</th><th>Số chế tạo</th><th>Năm sản xuất</th><th>Trạng thái</th>{canEdit && <th>Thao tác</th>}</tr></thead><tbody>{equipment.map(e=><tr key={e.id}><td><Link href={"/equipment/"+e.code+"?workspace="+e.workspace_id}>{e.code}</Link><p className="muted">{e.name}</p></td><td>{categoryLabels[e.category as keyof typeof categoryLabels]??"Chưa phân loại"}</td><td>{e.serial_number??"Chưa ghi"}</td><td>{e.manufacture_year??"Chưa ghi"}</td><td>{statusLabels[e.status]??"Chưa xác định"}</td>{canEdit && <td><Link className="button button-secondary" href={base+"&edit="+e.id+"#them-phuong-tien"}>Chỉnh sửa</Link></td>}</tr>)}</tbody></table>:<p className="muted">Danh mục còn trống. Chưa có phương tiện nào được nhập tự động.</p>}
  </section>{p.edit && !selected && <p role="alert">Không tìm thấy phương tiện được phép sửa trong khu vực này. Hãy chọn lại từ danh sách.</p>}
  {canEdit?(p.edit && !selected?<p><Link href={base}>Trở về danh mục để chọn phương tiện</Link></p>:<div id="them-phuong-tien"><EquipmentEditor key={selected?.id??"new"} workspace={c.workspace.id} equipment={selected}/>{selected && <p className="mt-3"><Link href={base}>Hủy chỉnh sửa / thêm phương tiện khác</Link></p>}</div>):<section className="panel"><h2>Quyền xem danh mục</h2><p>Bạn được xem phương tiện trong khu vực này. Chỉ người quản lý khu vực được thêm hoặc sửa thông tin.</p></section>}
  <p className="muted">Ảnh thiết bị và lịch sử lắp/tháo khung cẩu sẽ bổ sung ở bước tiếp theo. Chưa có nút xóa phương tiện để tránh làm mất liên kết dữ liệu.</p></>;
}
