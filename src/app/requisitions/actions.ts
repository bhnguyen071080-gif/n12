"use server";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {session} from "@/lib/supabase";
import type {Json} from "@/lib/database";
import {actualDay} from "@/lib/monthly-hours";
import type {ActionResult} from "@/app/actions";

const source=z.enum(["warehouse","maintenance_consumable"]);
const material=z.object({key:z.string().min(1).max(100),name:z.string().min(1).max(500),unit:z.string().min(1).max(40),quantity:z.number().positive().max(100000),source,catalogueCode:z.string().max(100).optional()}).strict();
const row=z.object({equipmentId:z.string().uuid(),equipmentCode:z.string().min(1).max(40),equipmentName:z.string().max(200).optional(),sourceLabel:z.string().min(1).max(200),group:z.enum(["TUKAN","QC","RTG","KHUNG_CAU"]),maintenanceLevel:z.enum(["I - theo giờ","I - theo tháng","II"]),operatingReading:z.string().max(200).optional(),materials:z.array(material).min(1).max(20)}).strict();

export async function saveMaintenanceRequisition(data:FormData):Promise<ActionResult>{
 const {client}=await session("/requisitions");
 try{
  const rows=z.array(row).min(1).max(60).parse(JSON.parse(z.string().max(400000).parse(data.get("rows"))));
  const print={company:z.string().trim().min(1).max(200).parse(data.get("company")),department:z.string().trim().min(1).max(200).parse(data.get("department")),recipient:z.string().trim().max(100).parse(data.get("recipient")),warehouse:z.string().trim().max(200).parse(data.get("warehouse")),consumableWarehouse:z.string().trim().max(200).parse(data.get("consumable_warehouse")),documentDay:actualDay(String(data.get("document_day")??""))};
  const result=await client.rpc("save_maintenance_requisition_v2",{p_workspace:z.string().uuid().parse(data.get("workspace")),p_day:actualDay(String(data.get("planned_day")??"")),p_grouping:z.enum(["equipment","group","date"]).parse(data.get("grouping")),p_rows:rows as unknown as Json,p_print:print,p_source_filename:z.string().min(1).max(255).parse(data.get("source_filename")),p_source_sha256:z.string().regex(/^[a-f0-9]{64}$/).parse(data.get("source_sha256")),p_key:z.string().uuid().parse(data.get("request_key"))});
  if(result.error){
   if(result.error.code==="42501")return {ok:false,message:"Bạn chưa có quyền xác nhận kế hoạch bảo dưỡng."};
   if(result.error.code==="42883")return {ok:false,message:"Cơ sở dữ liệu chưa được nâng cấp chức năng liên kết PDF. Chưa ghi dữ liệu."};
   return {ok:false,message:"Chưa lưu được kế hoạch. Kiểm tra mã phương tiện, vật tư và tệp PDF; không có dữ liệu nhập dở."};
  }
  revalidatePath("/requisitions");revalidatePath("/cases");revalidatePath("/history");revalidatePath("/");
  return {ok:true,message:"Đã xác nhận nhập kế hoạch, lưu dấu vết tệp PDF và tạo vụ việc bảo dưỡng. Có thể mở phiếu để in.",id:result.data};
 }catch{return {ok:false,message:"Dữ liệu kế hoạch hoặc tệp PDF chưa hợp lệ. Hãy bấm kiểm tra trước khi xác nhận nhập."};}
}
