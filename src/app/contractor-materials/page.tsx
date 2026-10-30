import {WorkspaceSelect} from "@/components/workspace-select";
import {ContractorMaterialsPanel} from "@/components/contractor-materials-panel";
import {context} from "@/lib/supabase";
import {localInputNow} from "@/lib/domain";
import type {ContractorMaterialRow} from "@/lib/contractor-materials";

export const dynamic="force-dynamic";
export default async function ContractorMaterialsPage({searchParams}:{searchParams:Promise<{workspace?:string}>}){
 const params=await searchParams,current=await context(params.workspace);if(!current.workspace)return <p>Chưa có workspace.</p>;
 const workspace=current.workspace.id;
 const [equipment,records]=await Promise.all([
  current.client.from("equipment").select("id,code,name").eq("workspace_id",workspace).order("code"),
  current.client.from("contractor_materials").select("id,workspace_id,equipment_id,material_name,unit,quantity,contractor_name,signed_on,warranty_months,warranty_ends_on,notes,created_at").eq("workspace_id",workspace).order("warranty_ends_on").limit(1000)
 ]);
 if(equipment.error)throw new Error("Không đọc được danh mục phương tiện.");
 if(records.error)throw new Error("Không đọc được vật tư nhà thầu.");
 const equipmentById=new Map(equipment.data.map(row=>[row.id,row]));
 const rows:ContractorMaterialRow[]=records.data.map(row=>{const machine=equipmentById.get(row.equipment_id);return {...row,quantity:Number(row.quantity),equipment_code:machine?.code??"?",equipment_name:machine?.name??"Không còn trong danh mục"};});
 return <><WorkspaceSelect workspaces={current.workspaces} selected={workspace}/><ContractorMaterialsPanel workspace={workspace} equipment={equipment.data} rows={rows} today={localInputNow().slice(0,10)}/></>;
}

