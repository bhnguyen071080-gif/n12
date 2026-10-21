import {RequisitionPlanForm} from "@/components/requisition-plan-form";
import {WorkspaceSelect} from "@/components/workspace-select";
import {context} from "@/lib/supabase";
import Link from "next/link";
import {saveRequisitionPlan} from "@/app/requisition-plan-actions";
import {formatPlannedDay} from "@/lib/maintenance-requisition-plan";

export const dynamic="force-dynamic";

export default async function RequisitionsPage({searchParams}:{searchParams:Promise<{workspace?:string}>}){
 const params=await searchParams;
 const current=await context(params.workspace);
 if(!current.workspace)return <p>Chưa có workspace.</p>;
 const [equipment,plans,memberships]=await Promise.all([
  current.client.from("equipment").select("id,code,name").eq("workspace_id",current.workspace.id).neq("base_status","decommissioned").order("code"),
  current.client.from("maintenance_requisition_runs").select("id,planned_day,created_at,grouping_mode").eq("workspace_id",current.workspace.id).order("created_at",{ascending:false}).limit(30),
  current.client.from("workspace_memberships").select("role").eq("workspace_id",current.workspace.id).eq("user_id",current.user.id).eq("active",true),
 ]);
 if(equipment.error)throw new Error("Không đọc được danh mục phương tiện.");
 return <>
  <WorkspaceSelect workspaces={current.workspaces} selected={current.workspace.id}/>
  {plans.error?<p role="alert">Chưa đọc được kế hoạch đã lưu. Kiểm tra kết nối và cập nhật cơ sở dữ liệu trước khi lưu mới.</p>:<section className="panel"><h2>Kế hoạch đã lưu gần đây</h2>{plans.data?.length?<ul>{plans.data.map(plan=><li key={plan.id}><Link href={`/requisitions/${plan.id}`}>{formatPlannedDay(plan.planned_day)} · {plan.grouping_mode==="group"?"Theo nhóm":plan.grouping_mode==="equipment"?"Theo phương tiện":"Theo ngày"} · lưu {new Date(plan.created_at).toLocaleString("vi-VN",{timeZone:"Asia/Bangkok"})}</Link></li>)}</ul>:<p>Chưa có kế hoạch được lưu.</p>}</section>}
  <RequisitionPlanForm key={current.workspace.id} workspaceId={current.workspace.id} workspaceName={current.workspace.name} equipment={equipment.data??[]} saveAction={!plans.error&&memberships.data?.some(m=>["KY_THUAT_VIEN","TRUONG_BO_PHAN_KY_THUAT"].includes(m.role))?saveRequisitionPlan:undefined}/>
 </>;
}

