import Link from "next/link";
import {context} from "@/lib/supabase";
import {CaseEntry} from "@/components/case-editor";
import {WorkspaceSelect} from "@/components/workspace-select";
import {kindLabels} from "@/lib/followup";
export const dynamic="force-dynamic";
export default async function Cases({searchParams}:{searchParams:Promise<{workspace?:string;page?:string}>}){
 const p=await searchParams,c=await context(p.workspace);if(!c.workspace)return <p>Chưa có workspace.</p>;const w=c.workspace.id;
 const page=/^\d+$/.test(p.page??"")?Math.max(1,Number(p.page)):1,pageSize=50;
 const [equipment,membership]=await Promise.all([
 c.client.from("equipment").select("id,code,name").eq("workspace_id",w).order("name"),
 c.client.from("workspace_memberships").select("role").eq("workspace_id",w).eq("user_id",c.user.id).eq("active",true)]);
 if(equipment.error||membership.error)throw new Error("Không đọc được danh mục/quyền.");
 const equipmentIds=equipment.data?.map(e=>e.id)??[];
 const orders=equipmentIds.length?await c.client.from("work_cases").select("id,equipment_id,code,summary,kind,created_at",{count:"exact"}).eq("tracking_only",true).in("equipment_id",equipmentIds).order("created_at",{ascending:false}).range((page-1)*pageSize,page*pageSize-1):{data:[],error:null,count:0};
 if(orders.error)throw new Error("Không đọc được vụ việc.");
 const caseIds=orders.data?.map(r=>r.id)??[];
 const followup=caseIds.length?await c.client.from("case_material_followups").select("case_id,return_status").in("case_id",caseIds):{data:[],error:null};
 if(followup.error)throw new Error("Không đọc được trả phiếu.");
 const labels=new Map(equipment.data?.map(e=>[e.id,e.name===e.code?e.name:`${e.name} (mã ${e.code})`])),states=new Map(followup.data?.map(f=>[f.case_id,f.return_status]));
 const rows=orders.data??[],total=orders.count??rows.length,pages=Math.max(1,Math.ceil(total/pageSize)),currentPage=Math.min(page,pages),canCatalogue=membership.data?.some(r=>r.role==="CAN_BO_VAT_TU"||r.role==="TRUONG_BO_PHAN_KY_THUAT");
 const canCreate=membership.data?.some(r=>r.role==="KY_THUAT_VIEN"||r.role==="TRUONG_BO_PHAN_KY_THUAT");
 return <><h1>Vụ việc kỹ thuật</h1><WorkspaceSelect workspaces={c.workspaces} selected={w}/><p>Tạo vụ việc kỹ thuật tại đây. Bổ sung hoặc sửa mã vật tư thực hiện riêng trong Danh mục vật tư để tránh trùng và sai tên.</p>
 <section className="panel"><div className="section-heading"><h2>Vụ việc gần nhất</h2><span className="count-chip">{total} vụ việc</span></div><div className="overflow-x-auto catalog-table-scroll"><table className="compact-table"><thead><tr><th>Mã vụ việc</th><th>Phương tiện</th><th>Loại</th><th>Nội dung</th><th>Trả phiếu</th><th>Thao tác</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}>
 <td><Link href={"/cases/"+r.id}>{r.code}</Link></td><td>{labels.get(r.equipment_id)}</td><td>{kindLabels[r.kind]}</td><td className="single-line" title={r.summary}>{r.summary}</td><td>{states.get(r.id)==="completed"?"Đã hoàn tất":"Chưa hoàn tất / chưa phát sinh"}</td><td><div className="table-actions"><Link className="button button-secondary table-action" href={"/cases/"+r.id+"?document=material_requisition#ho-so-bieu-mau"}>Xem trước phiếu</Link></div></td></tr>)}</tbody></table></div>
 {pages>1&&<nav className="table-pagination no-print" aria-label="Phân trang vụ việc"><span>Trang {currentPage} / {pages}</span><div>{currentPage>1&&<Link className="button button-secondary" href={"/cases?"+new URLSearchParams({workspace:w,page:String(currentPage-1)})}>Trang trước</Link>}<strong>{Math.min((currentPage-1)*pageSize+1,total)}–{Math.min(currentPage*pageSize,total)} / {total}</strong>{currentPage<pages&&<Link className="button button-secondary" href={"/cases?"+new URLSearchParams({workspace:w,page:String(currentPage+1)})}>Trang sau</Link>}</div></nav>}
 </section>
 <div className="flex flex-wrap gap-4"><Link className="button button-secondary" href={"/history?workspace="+w}>Chiết xuất lý lịch phương tiện</Link>{canCatalogue&&<Link className="button button-secondary" href={"/materials?workspace="+w}>Mở danh mục vật tư</Link>}</div>
 {canCreate&&<CaseEntry equipment={equipment.data??[]}/ >}</>;
}

