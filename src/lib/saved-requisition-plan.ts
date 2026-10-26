import {z} from "zod";
import {uuid} from "./domain";
import {documentPayloadFields} from "./documents";
import {buildVoucherPreviews,octoberMaintenancePlan,planGroupLabels,type MaintenancePlanRow,type VoucherPreview} from "./maintenance-requisition-plan";
import {createEquipmentIdentityMatcher} from "./equipment-display";

const short=z.string().trim().max(200).refine(s=>!/[\u0000-\u001f]/.test(s),"Ký tự không hợp lệ");
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{const d=new Date(s+"T00:00:00Z");return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;},"Ngày không hợp lệ");
export const planPrintSchema=z.object({company:short.refine(s=>s.length>0),department:short.refine(s=>s.length>0),recipient:short.refine(s=>s.length<=100),warehouse:short,consumableWarehouse:short,documentDay:day.refine(s=>s>="2000-01-01"&&s<="2100-12-31"),voucherKind:z.enum(["planned","supplemental"]).optional(),supplementNote:z.string().trim().max(500).optional()}).strict();
export const savePlanInputSchema=z.object({
 plannedDay:day.refine(s=>s.startsWith("2026-10-"),"Chọn ngày trong tháng kế hoạch 10/2026"),
 grouping:z.enum(["equipment","group","date"]),groups:z.array(z.enum(["TUKAN","QC","RTG","KHUNG_CAU"])).min(1).max(4),
 mappings:z.record(z.string(),uuid),print:planPrintSchema,
}).strict();
export type SavePlanInput=z.infer<typeof savePlanInputSchema>;
export type PlanEquipment={id:string;code:string;name:string};
export type SavedPlanRow=MaintenancePlanRow&{equipmentId:string;equipmentName:string;caseId:string;caseCode:string};
export type SavedRequisitionPlan={id:string;workspace_id:string;planned_day:string;grouping_mode:SavePlanInput["grouping"];snapshot:{version:1;rows:SavedPlanRow[];print:z.infer<typeof planPrintSchema>};created_at:string;created_by:string};

export function resolvePlanRows(input:SavePlanInput,equipment:PlanEquipment[]){
 const used=new Set<string>(),matchIdentity=createEquipmentIdentityMatcher(equipment);
 return octoberMaintenancePlan.filter(row=>input.groups.includes(row.group)).map(row=>{
  const selected=input.mappings[row.equipmentCode];
  const found=selected?equipment.find(e=>e.id===selected):matchIdentity(row.equipmentCode,row.sourceLabel);
  if(!found)throw new Error(`Chưa ghép phương tiện: ${row.sourceLabel}`);
  if(used.has(found.id))throw new Error("Hai dòng kế hoạch không được ghép cùng một phương tiện");
  used.add(found.id);
  return {...row,equipmentId:found.id,equipmentCode:found.code,equipmentName:found.name};
 });
}
export function savedPlanVouchers(plan:SavedRequisitionPlan):VoucherPreview[]{
 if(plan.snapshot.version!==1)throw new Error("Phiên bản kế hoạch chưa hỗ trợ");
 return buildVoucherPreviews(plan.snapshot.rows,Object.keys(planGroupLabels) as (keyof typeof planGroupLabels)[],plan.grouping_mode,plan.planned_day);
}
// Plan requisitions have their own source and validator. They are never disguised
// as case documents or linked to an arbitrary case in a multi-equipment voucher.
export const planVoucherPayloadSchema=documentPayloadFields.extend({
 kind:z.literal("material_requisition"),voucher_template:z.literal("bm0806"),basis_document_id:z.never().optional(),
}).superRefine((d,c)=>{
 if(!d.lines.length||d.lines.some(l=>l.usage_id!==null||l.issued!==null||l.unit_price!==null))c.addIssue({code:"custom",message:"Phiếu kế hoạch chỉ có số xin lĩnh"});
});
export function planVoucherPayload(plan:SavedRequisitionPlan,voucher:VoucherPreview){
 const p=planPrintSchema.parse(plan.snapshot.print);
 const labels=voucher.equipmentLabels.join(", "),scope=labels.length<=500?labels:`${voucher.equipmentLabels.length} phương tiện (xem phân bổ trong kế hoạch ${plan.id})`;
 return planVoucherPayloadSchema.parse({schema_version:1,kind:"material_requisition",voucher_template:"bm0806",company:p.company,department:p.department,
 unit:"",location:"",form_code:"BM.08.06",document_number:"",document_at:p.documentDay+"T08:00",equipment_label:voucher.scopeLabel,
 inspection_subject:"",reason:`${p.voucherKind==="supplemental"?"Bổ sung phát sinh: "+p.supplementNote+". ":""}Bảo dưỡng theo kế hoạch ${plan.planned_day.slice(0,7)}, ngày ${plan.planned_day}. ${voucher.scopeLabel}. Phương tiện: ${scope}`,
 warehouse:voucher.source==="warehouse"?p.warehouse:p.consumableWarehouse,participants:[],cause:"",solution:"",signer_names:["","",p.recipient,"",""],amount_words:"",
 lines:voucher.lines.map(l=>({usage_id:null,name:l.name,specification:"",catalogue_code:l.catalogueCode??"",unit:l.unit,requested:l.quantity,issued:null,unit_price:null,limit_text:"",used_text:"",condition:"",notes:""}))});
}

