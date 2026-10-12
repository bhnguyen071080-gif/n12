import Link from "next/link";
import {context} from "@/lib/supabase";
import {CaseEntry,MaterialEntry} from "@/components/case-editor";
import {WorkspaceSelect} from "@/components/workspace-select";
import {kindLabels} from "@/lib/followup";
export const dynamic="force-dynamic";
export default async function Cases({searchParams}:{searchParams:Promise<{workspace?:string}>}){
 const p=await searchParams,c=await context(p.workspace);if(!c.workspace)return <p>Chưa có workspace.</p>;const w=c.workspace.id;
 const [equipment,orders,followup,membership]=await Promise.all([
 c.client.from("equipment").select("id,code").eq("workspace_id",w).order("code"),
 c.client.from("work_cases").select("*").eq("tracking_only",true).order("created_at",{ascending:false}).limit(500),
 c.client.from("case_material_followups").select("*"),
 c.client.from("workspace_memberships").select("role").eq("workspace_id",w).eq("user_id",c.user.id).eq("active",true)]);
 if(equipment.error||orders.error||followup.error||membership.error)throw new Error("Không đọc được vụ việc.");
 const codes=new Map(equipment.data?.map(e=>[e.id,e.code])),states=new Map(followup.data?.map(f=>[f.case_id,f.return_status]));
 const rows=orders.data?.filter(r=>codes.has(r.equipment_id)),canCatalogue=membership.data?.some(r=>r.role==="CAN_BO_VAT_TU"||r.role==="TRUONG_BO_PHAN_KY_THUAT");
 return <><h1>Vụ việc & theo dõi vật tư</h1><WorkspaceSelect workspaces={c.workspaces} selected={w}/><p>Mỗi vụ việc nhiều hạng mục/vật tư, một trạng thái trả phiếu chung. Không lập phiếu hay ghi sổ kho.</p>
 <section className="panel"><h2>500 vụ việc gần nhất</h2><div className="overflow-x-auto"><table><thead><tr><th>Mã vụ việc</th><th>Phương tiện</th><th>Loại</th><th>Nội dung</th><th>Trả phiếu</th></tr></thead><tbody>{rows?.map(r=><tr key={r.id}>
 <td><Link href={"/cases/"+r.id}>{r.code}</Link></td><td>{codes.get(r.equipment_id)}</td><td>{kindLabels[r.kind]}</td><td>{r.summary}</td><td>{states.get(r.id)==="completed"?"Đã hoàn tất":"Chưa hoàn tất / chưa phát sinh"}</td></tr>)}</tbody></table></div></section>
 <div className="grid gap-5 lg:grid-cols-2"><CaseEntry equipment={equipment.data??[]}/>{canCatalogue&&<MaterialEntry workspace={w}/>}</div></>;
}
