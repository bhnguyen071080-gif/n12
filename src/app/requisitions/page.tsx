import {RequisitionPlanForm} from "@/components/requisition-plan-form";
import {WorkspaceSelect} from "@/components/workspace-select";
import {context} from "@/lib/supabase";

export const dynamic="force-dynamic";

export default async function RequisitionsPage({searchParams}:{searchParams:Promise<{workspace?:string}>}){
 const params=await searchParams;
 const current=await context(params.workspace);
 if(!current.workspace)return <p>Chưa có workspace.</p>;
 const equipment=await current.client.from("equipment").select("code").eq("workspace_id",current.workspace.id).order("code");
 if(equipment.error)throw new Error("Không đọc được danh mục phương tiện.");
 return <>
  <WorkspaceSelect workspaces={current.workspaces} selected={current.workspace.id}/>
  <RequisitionPlanForm workspaceName={current.workspace.name} equipmentCodes={(equipment.data??[]).map(item=>item.code)}/>
 </>;
}

