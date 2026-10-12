import Link from "next/link";
import {context} from "@/lib/supabase";
import {equipmentSchema,statusLabels} from "@/lib/domain";
import {WorkspaceSelect} from "@/components/workspace-select";
export const dynamic="force-dynamic";
export default async function Home({searchParams}:{searchParams:Promise<{workspace?:string}>}){
 const params=await searchParams,c=await context(params.workspace);
 if(!c.workspace)return <><h1>Danh mục phương tiện</h1><p>Chưa được cấp không gian dữ liệu; liên hệ quản trị viên.</p></>;
 const result=await c.client.from("equipment").select("*").eq("workspace_id",c.workspace.id).order("code");if(result.error)throw new Error("Không đọc được PTTB");
 const debt=await c.client.from("vw_case_followup_backlog").select("*").eq("workspace_id",c.workspace.id).limit(100);
 if(debt.error)throw new Error("Không đọc được cảnh báo trả phiếu.");
 const equipment=equipmentSchema.array().parse(result.data);
 return <><h1>Phương tiện · {c.workspace.name}</h1><WorkspaceSelect workspaces={c.workspaces} selected={c.workspace.id}/>
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{equipment.map(e=><article className="panel" key={e.id}><h2><Link href={"/equipment/"+e.code+"?workspace="+e.workspace_id}>{e.code}</Link></h2>
   <p>{e.name}</p><p>{statusLabels[e.status]??e.status}</p><p><Link href={"/monthly?workspace="+e.workspace_id+"&kind=hours&equipment="+e.id}>Tổng giờ hoạt động tháng</Link></p>
   <Link className="button" href={"/equipment/"+e.code+"?workspace="+e.workspace_id+"&action=quick-inspect"}>Kiểm tra / báo hỏng</Link></article>)}</div>
  <section className="panel"><h2>Vụ việc còn nợ trả phiếu kho</h2>{debt.data?.length?debt.data.map(r=><p key={r.case_id}><Link href={"/cases/"+r.case_id}>{r.case_code}</Link> · {r.equipment_code} · {r.material_lines} dòng vật tư · {r.summary}</p>):<p>Không có vụ việc còn nợ trả phiếu trong luồng theo dõi mới.</p>}</section>
  {!equipment.length && <p>Chưa có thiết bị; cần nhập danh mục trước khi đồng bộ sản lượng.</p>}
 </>;
}
