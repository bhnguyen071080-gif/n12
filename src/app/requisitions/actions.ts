"use server";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {session} from "@/lib/supabase";
import type {Json} from "@/lib/database";
import {actualDay} from "@/lib/monthly-hours";
import type {ActionResult} from "@/app/actions";
import {planVoucherPayload,savedPlanVouchers,type SavedRequisitionPlan} from "@/lib/saved-requisition-plan";
import {renderPlanVoucherPdf} from "@/lib/document-pdf";

const source=z.enum(["warehouse","maintenance_consumable"]);
const material=z.object({key:z.string().min(1).max(100),name:z.string().min(1).max(500),unit:z.string().min(1).max(40),quantity:z.number().positive().max(100000),source,catalogueCode:z.string().max(100).optional()}).strict();
const row=z.object({equipmentId:z.guid(),equipmentCode:z.string().min(1).max(40),equipmentName:z.string().max(200).optional(),sourceLabel:z.string().min(1).max(200),group:z.enum(["TUKAN","QC","RTG","KHUNG_CAU"]),maintenanceLevel:z.enum(["I - theo giờ","I - theo tháng","II"]),operatingReading:z.string().max(200).optional(),materials:z.array(material).min(1).max(20)}).strict();

export async function saveMaintenanceRequisition(data:FormData):Promise<ActionResult>{
 const {client}=await session("/requisitions");
 try{
  if(data.get("confirmed")!=="on")return {ok:false,message:"Cần xác nhận đã đối chiếu tệp nguồn, phương tiện và số lượng."};
  const rows=z.array(row).min(1).max(60).parse(JSON.parse(z.string().max(400000).parse(data.get("rows"))));
  const voucherKind=z.enum(["planned","supplemental"]).parse(data.get("voucher_kind")),supplementNote=z.string().trim().max(500).parse(data.get("supplement_note"));
  if(voucherKind==="supplemental"&&supplementNote.length<3)return {ok:false,message:"Phiếu bổ sung cần ghi rõ lý do phát sinh."};
  const rawDetails=z.array(z.object({id:z.string().min(1).max(200),documentNumber:z.string().trim().min(1).max(200),documentDay:z.string()}).strict()).min(1).max(200).parse(JSON.parse(z.string().max(100000).parse(data.get("voucher_details"))));
  const voucherDetails=rawDetails.map(detail=>({...detail,documentDay:actualDay(detail.documentDay)}));
  if(new Set(voucherDetails.map(detail=>detail.id)).size!==voucherDetails.length)return {ok:false,message:"Mỗi phiếu phải có một số phiếu và ngày phiếu riêng."};
  const documentDay=voucherDetails[0].documentDay;
  const print={company:z.string().trim().min(1).max(200).parse(data.get("company")),department:z.string().trim().min(1).max(200).parse(data.get("department")),recipient:z.string().trim().max(100).parse(data.get("recipient")),warehouse:z.string().trim().max(200).parse(data.get("warehouse")),consumableWarehouse:z.string().trim().max(200).parse(data.get("consumable_warehouse")),documentDay,voucherDetails,voucherKind,supplementNote:voucherKind==="supplemental"?supplementNote:""};
  const draft={id:String(data.get("request_key")),planned_day:actualDay(String(data.get("planned_day")??"")),grouping_mode:z.enum(["equipment","group","date"]).parse(data.get("grouping")),snapshot:{version:1,rows,print}} as SavedRequisitionPlan;
  const vouchers=savedPlanVouchers(draft);
  if(vouchers.length!==voucherDetails.length||vouchers.some(voucher=>!voucherDetails.some(detail=>detail.id===voucher.id)))return {ok:false,message:"Thông tin số/ngày phiếu chưa khớp với các phiếu đang xem trước."};
  for(const voucher of vouchers)await renderPlanVoucherPdf(planVoucherPayload(draft,voucher),draft.id,new Date().toISOString());
  const result=await client.rpc("save_maintenance_requisition_v3",{p_workspace:z.guid().parse(data.get("workspace")),p_planned_day:draft.planned_day,p_document_day:documentDay,p_voucher_kind:voucherKind,p_supplement_note:voucherKind==="supplemental"?supplementNote:null,p_grouping:draft.grouping_mode,p_rows:rows as unknown as Json,p_print:print,p_source_filename:z.string().min(1).max(255).parse(data.get("source_filename")),p_source_sha256:z.string().regex(/^[a-f0-9]{64}$/).parse(data.get("source_sha256")),p_key:z.guid().parse(data.get("request_key"))});
  if(result.error){
   if(result.error.code==="42501")return {ok:false,message:"Bạn chưa có quyền xác nhận kế hoạch bảo dưỡng."};
   if(result.error.code==="42883")return {ok:false,message:"Cơ sở dữ liệu chưa được nâng cấp chức năng ngày phiếu lĩnh. Chưa ghi dữ liệu."};
   if(result.error.message.includes("thông tin in"))return {ok:false,message:"Số phiếu hoặc ngày phiếu chưa khớp bản xem trước. Hãy kiểm tra lại từng phiếu rồi thử lưu."};
   if(result.error.message.includes("Phương tiện"))return {ok:false,message:"Có phương tiện chưa khớp danh mục hoặc đã ngừng quản lý. Chưa ghi dữ liệu."};
   return {ok:false,message:"Chưa lưu được kế hoạch. Kiểm tra mã phương tiện, vật tư và tệp PDF; không có dữ liệu nhập dở."};
  }
  revalidatePath("/requisitions");revalidatePath("/cases");revalidatePath("/history");revalidatePath("/");
  return {ok:true,message:voucherKind==="supplemental"?"Đã lưu phiếu bổ sung với ngày lĩnh thực tế riêng và liên kết cùng công việc bảo dưỡng.":"Đã xác nhận kế hoạch, lưu ngày lĩnh thực tế và tạo vụ việc bảo dưỡng. Có thể mở phiếu để in.",id:result.data};
 }catch{return {ok:false,message:"Dữ liệu kế hoạch hoặc tệp PDF chưa hợp lệ. Hãy bấm kiểm tra trước khi xác nhận nhập."};}
}



