import Link from "next/link";
import {context} from "@/lib/supabase";
import {equipmentSchema,formatNumber,statusLabels} from "@/lib/domain";
import {WorkspaceSelect} from "@/components/workspace-select";
export const dynamic="force-dynamic";
export default async function Home({searchParams}:{searchParams:Promise<{workspace?:string}>}){
 const params=await searchParams,c=await context(params.workspace);
 if(!c.workspace)return <><h1>Danh mục phương tiện</h1><p>Chưa được cấp không gian dữ liệu; liên hệ quản trị viên.</p></>;
 const result=await c.client.from("equipment").select("*").eq("workspace_id",c.workspace.id).order("code");if(result.error)throw new Error("Không đọc được PTTB");
 const equipment=equipmentSchema.array().parse(result.data);
 return <><h1>Phương tiện · {c.workspace.name}</h1><WorkspaceSelect workspaces={c.workspaces} selected={c.workspace.id}/>
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{equipment.map(e=><article className="panel" key={e.id}><h2><Link href={"/equipment/"+e.code+"?workspace="+e.workspace_id}>{e.code}</Link></h2>
   <p>{e.name}</p><p>{statusLabels[e.status]??e.status}</p><p>Giờ lũy kế: {formatNumber(e.accumulated_hours)} h</p>
   <Link className="button" href={"/equipment/"+e.code+"?workspace="+e.workspace_id+"&action=quick-inspect"}>Kiểm tra / báo hỏng</Link></article>)}</div>
  {!equipment.length && <p>Chưa có thiết bị; cần nhập danh mục trước khi đồng bộ sản lượng.</p>}
 </>;
}
