"use server";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import type {ActionResult} from "@/app/actions";
import {monthStart,uuid} from "@/lib/domain";
import {session} from "@/lib/supabase";

const value=(data:FormData,key:string)=>String(data.get(key)??"");
const refresh=()=>{revalidatePath("/container-reports");revalidatePath("/monthly");revalidatePath("/reports");};
const failure=(code?:string):ActionResult=>({ok:false,message:code==="23505"?"Đã có số liệu cho phương tiện trong kỳ này. Hãy chọn Chỉnh sửa thay vì tạo mới.":code==="40001"?"Dữ liệu vừa được người khác cập nhật. Hãy tải lại trước khi sửa.":code==="P0001"?"Số liệu bất thường. Hãy đối chiếu, tích xác nhận cảnh báo rồi lưu lại.":code==="42501"?"Tài khoản không có quyền thực hiện hoặc bản ghi đã khóa.":"Chưa lưu được. Kiểm tra kỳ, phương tiện, số container và trạng thái."});

export async function saveContainerReport(data:FormData):Promise<ActionResult>{
 try{
  const {client}=await session("/container-reports"),id=value(data,"id"),version=value(data,"version");
  const result=await client.rpc("save_container_report_month",{p_workspace:uuid.parse(value(data,"workspace")),p_id:id?uuid.parse(id):null,p_expected_version:version?z.coerce.number().int().positive().parse(version):null,p_equipment:uuid.parse(value(data,"equipment")),p_month:monthStart(value(data,"month")),p_boxes:z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).parse(value(data,"boxes")),p_notes:z.string().trim().max(2000).parse(value(data,"notes")),p_status:z.enum(["draft","summarized"]).parse(value(data,"status")),p_anomaly_acknowledged:data.get("anomaly_acknowledged")==="on",p_key:uuid.parse(value(data,"request_key"))});
  if(result.error)return failure(result.error.code);refresh();return {ok:true,message:id?"Đã cập nhật số liệu; nếu trước đó đã kiểm tra, hệ thống yêu cầu kiểm tra lại.":"Đã lưu số liệu tháng vào bảng tổng hợp.",id:result.data};
 }catch{return failure();}
}

export async function setContainerReportStatus(data:FormData):Promise<ActionResult>{
 try{const {client}=await session("/container-reports"),result=await client.rpc("set_container_report_status",{p_id:uuid.parse(value(data,"id")),p_expected_version:z.coerce.number().int().positive().parse(value(data,"version")),p_status:z.enum(["checked","locked"]).parse(value(data,"status"))});if(result.error)return failure(result.error.code);refresh();return {ok:true,message:value(data,"status")==="locked"?"Đã khóa số liệu.":"Đã kiểm tra số liệu."};}catch{return failure();}
}

export async function adminContainerReportAction(data:FormData):Promise<ActionResult>{
 try{const {client}=await session("/container-reports"),args={p_id:uuid.parse(value(data,"id")),p_expected_version:z.coerce.number().int().positive().parse(value(data,"version")),p_reason:z.string().trim().min(5).max(500).parse(value(data,"reason"))},kind=z.enum(["reopen","cancel"]).parse(value(data,"kind")),result=kind==="reopen"?await client.rpc("admin_reopen_container_report",args):await client.rpc("admin_cancel_container_report",args);if(result.error)return failure(result.error.code);refresh();return {ok:true,message:kind==="reopen"?"Đã mở khóa và lưu lý do vào lịch sử.":"Đã hủy bản ghi; dữ liệu vẫn được giữ trong lịch sử."};}catch{return {ok:false,message:"Chỉ Quản trị hệ thống được thực hiện và phải nhập lý do ít nhất 5 ký tự."};}
}
