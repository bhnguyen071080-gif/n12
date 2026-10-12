import {z} from "zod";
import {numeric,uuid} from "./domain";
import {actualDay} from "./monthly-hours";
export const kinds=["repair","maintenance","cleaning","inspection"] as const;
export const kindLabels={repair:"Sửa chữa",maintenance:"Bảo dưỡng",cleaning:"Vệ sinh",inspection:"Kiểm tra"} as const;
export const progressOptions={
 basis_status:{incident_code_assigned:"Đã có mã vụ việc",minutes_in_progress:"Đang lập biên bản",no_basis:"Chưa có căn cứ"},
 material_status:{stock_available:"Đủ vật tư kho",borrowed:"Đang vay vật tư",procurement_pending:"Chờ mua sắm",not_required:"Không dùng vật tư"},
 requisition_status:{requisition_created:"Đã lập phiếu lĩnh",temporary_issue_debt:"Nợ phiếu (tạm xuất)",approval_pending:"Chờ duyệt phiếu",not_applicable:"Không phát sinh"},
 execution_status:{completed:"Hoàn thành",in_progress:"Đang thi công",waiting_shutdown:"Chờ dừng máy"},
 acceptance_status:{accepted:"Đã nghiệm thu",pending:"Chờ nghiệm thu",rework_required:"Yêu cầu xử lý lại"},
 dossier_status:{closed:"Đã đóng hồ sơ",missing_reimbursement_documents:"Thiếu chứng từ hoàn ứng",collecting:"Đang tập hợp"}
} as const;
export const progressNames={basis_status:"Căn cứ",material_status:"Vật tư",requisition_status:"Phiếu lĩnh",execution_status:"Thực hiện",acceptance_status:"Nghiệm thu",dossier_status:"Hồ sơ"} as const;
export const defaults={basis_status:"no_basis",material_status:"procurement_pending",requisition_status:"not_applicable",execution_status:"waiting_shutdown",acceptance_status:"pending",dossier_status:"collecting"} as const;
export const itemPayload=z.object({
 symptom:z.string().max(8000),root_cause:z.string().max(8000),solution_plan:z.string().max(8000),execution_result:z.string().max(8000),
 performed_on:z.string().transform(actualDay).nullable(),
 basis_status:z.enum(["incident_code_assigned","minutes_in_progress","no_basis"]),material_status:z.enum(["stock_available","borrowed","procurement_pending","not_required"]),
 requisition_status:z.enum(["requisition_created","temporary_issue_debt","approval_pending","not_applicable"]),execution_status:z.enum(["completed","in_progress","waiting_shutdown"]),
 acceptance_status:z.enum(["accepted","pending","rework_required"]),dossier_status:z.enum(["closed","missing_reimbursement_documents","collecting"])
}).strict();
export const itemSchema=itemPayload.extend({id:uuid,repair_order_id:uuid,item_no:z.number().int(),version_no:z.number().int()});
export type WorkItem=z.infer<typeof itemSchema>;
export const lifeReportSchema=z.object({
 material_id:uuid,material_code:z.string(),material_name:z.string(),unit:z.string(),usage_id:uuid,case_id:uuid.nullable(),
 case_code:z.string().nullable(),order_code:z.string(),position:z.string(),performed_on:z.string(),from_month:z.string(),to_month:z.string(),
 recorded_hours:numeric.nullable(),missing_months:numeric,limit_hours:numeric.nullable(),remaining_hours:numeric.nullable(),alert_level:z.string()
});
export type MaterialHours=z.infer<typeof lifeReportSchema>;
export const supplyLabels={planned:"Chưa vay/lĩnh",borrowed:"Đang vay",issued:"Đã lĩnh"} as const;
