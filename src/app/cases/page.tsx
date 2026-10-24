import Link from "next/link";
import {context} from "@/lib/supabase";
import {CaseEntry} from "@/components/case-editor";
import {WorkspaceSelect} from "@/components/workspace-select";
import {kindLabels} from "@/lib/followup";
export const dynamic="force-dynamic";
export default async function Cases({searchParams}:{searchParams:Promise<{workspace?:string}>}){
 const p=await searchParams,c=await context(p.workspace);if(!c.workspace)return <p>Chưa có workspace.</p>;const w=c.workspace.id;
 const [equipment,membership]=await Promise.all([
 c.client.from("equipment").select("id,code").eq("workspace_id",w).order("code"),
 c.client.from("workspace_memberships").select("role").eq("workspace_id",w).eq("user_id",c.user.id).eq("active",true)]);
 if(equipment.error||membership.error)throw new Error("Không đọc được danh mục/quyền.");
 const equipmentIds=equipment.data?.map(e=>e.id)??[];
 const orders=equipmentIds.length?await c.client.from("work_cases").select("*").eq("tracking_only",true).in("equipment_id",equipmentIds).order("created_at",{ascending:false}).limit(500):{data:[],error:null};
 if(orders.error)throw new Error("Không đọc được vụ việc.");
 const caseIds=orders.data?.map(r=>r.id)??[];
 const followup=caseIds.length?await c.client.from("case_material_followups").select("*").in("case_id",caseIds):{data:[],error:null};
 if(followup.error)throw new Error("Không đọc được trả phiếu.");
 const codes=new Map(equipment.data?.map(e=>[e.id,e.code])),states=new Map(followup.data?.map(f=>[f.case_id,f.return_status]));
 const rows=orders.data??[],canCatalogue=membership.data?.some(r=>r.role==="CAN_BO_VAT_TU"||r.role==="TRUONG_BO_PHAN_KY_THUAT");
 const canCreate=membership.data?.some(r=>r.role==="KY_THUAT_VIEN"||r.role==="TRUONG_BO_PHAN_KY_THUAT");
 return <><h1>Vụ việc & lý lịch phương tiện</h1><WorkspaceSelect workspaces={c.workspaces} selected={w}/><p>Tạo vụ việc kỹ thuật tại đây. Bổ sung hoặc sửa mã vật tư thực hiện riêng trong Danh mục vật tư để tránh trùng và sai tên.</p>
 <section className="panel"><h2>500 vụ việc gần nhất</h2><div className="overflow-x-auto"><table><thead><tr><th>Mã vụ việc</th><th>Phương tiện</th><th>Loại</th><th>Nội dung</th><th>Trả phiếu</th><th>Thao tác</th></tr></thead><tbody>{rows?.map(r=><tr key={r.id}>
 <td><Link href={"/cases/"+r.id}>{r.code}</Link></td><td>{codes.get(r.equipment_id)}</td><td>{kindLabels[r.kind]}</td><td>{r.summary}</td><td>{states.get(r.id)==="completed"?"Đã hoàn tất":"Chưa hoàn tất / chưa phát sinh"}</td><td><div className="table-actions"><Link className="button button-secondary" href={"/cases/"+r.id}>Xem chi tiết</Link><Link className="button button-secondary" href={"/cases/"+r.id+"?document=material_requisition#ho-so-bieu-mau"}>Xem trước phiếu</Link></div></td></tr>)}</tbody></table></div></section>
 <div className="flex flex-wrap gap-4"><Link className="button button-secondary" href={"/history?workspace="+w}>Chiết xuất lý lịch phương tiện</Link>{canCatalogue&&<Link className="button button-secondary" href={"/materials?workspace="+w}>Mở danh mục vật tư</Link>}</div>
 {canCreate&&<CaseEntry equipment={equipment.data??[]}/ >}</>;
}
