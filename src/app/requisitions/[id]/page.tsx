import {notFound} from "next/navigation";
import {uuid} from "@/lib/domain";
import {session} from "@/lib/supabase";
import {planVoucherPayload,savedPlanVouchers} from "@/lib/saved-requisition-plan";
import {supplySourceLabels} from "@/lib/maintenance-requisition-plan";
import {SavedRequisitionDetail} from "@/components/saved-requisition-detail";
export const dynamic="force-dynamic";
export default async function SavedPlanPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!uuid.safeParse(id).success)notFound();
 const {client}=await session(`/requisitions/${id}`);
 const result=await client.from("maintenance_requisition_runs").select("*").eq("id",id).maybeSingle();
 if(result.error)throw new Error("Không đọc được kế hoạch");if(!result.data)notFound();
 const plan=result.data,vouchers=savedPlanVouchers(plan);
 return <SavedRequisitionDetail workspaceId={plan.workspace_id} plannedDay={plan.planned_day} createdAt={plan.created_at} sourceFilename={plan.source_filename}
  vouchers={vouchers.map((voucher,index)=>{const payload=planVoucherPayload(plan,voucher);return {id:voucher.id,scopeLabel:voucher.scopeLabel,sourceLabel:supplySourceLabels[voucher.source],documentNumber:payload.document_number,documentDay:payload.document_at.slice(0,10),equipmentLabels:voucher.equipmentLabels,pdfHref:`/api/requisition-plans/${id}/pdf?voucher=${index}`,lines:voucher.lines.map(line=>({name:line.name,catalogueCode:line.catalogueCode??"",unit:line.unit,quantity:line.quantity,note:line.equipmentLabel??line.equipmentCode??""}))};})}
  allocations={plan.snapshot.rows.map(row=>({equipmentId:row.equipmentId,sourceLabel:row.sourceLabel,equipmentLabel:`${row.equipmentCode} · ${row.equipmentName}`,caseId:row.caseId,caseCode:row.caseCode,materials:row.materials.map(material=>({key:material.key,name:material.name,quantity:material.quantity,unit:material.unit}))}))}/>;
}
