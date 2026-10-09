"use server";
import {z} from "zod";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {actualTimestamp,causes,containerRows,hoursRows,otherRows,safeNext,uuid,monthStart} from "@/lib/domain";
import {serverClient,session} from "@/lib/supabase";
export type ActionResult={ok:boolean;message:string;id?:string};
const value=(data:FormData,key:string)=>String(data.get(key)??"");
const denied=():ActionResult=>({ok:false,message:"Không thể lưu. Kiểm tra quyền, số liệu và trạng thái hồ sơ; gửi lại sẽ không tạo trùng."});
export async function login(data:FormData):Promise<ActionResult>{
 const email=value(data,"email"),password=value(data,"password");
 if(!z.string().email().safeParse(email).success || !password)return {ok:false,message:"Nhập email và mật khẩu."};
 let valid=false;
 try{const client=await serverClient();const result=await client.auth.signInWithPassword({email,password});valid=!result.error;}catch{return {ok:false,message:"Chưa kết nối được dịch vụ đăng nhập."};}
 if(!valid)return {ok:false,message:"Không đăng nhập được. Kiểm tra thông tin tài khoản."};
 redirect(safeNext(value(data,"next")));
}
export async function logout(){const client=await serverClient();await client.auth.signOut();redirect("/login");}
export async function saveMonthly(data:FormData):Promise<ActionResult>{
 try{
  const workspace=uuid.parse(value(data,"workspace")),key=uuid.parse(value(data,"request_key"));
  const input:unknown=JSON.parse(value(data,"rows"));const kind=z.enum(["hours","container","other"]).parse(value(data,"kind"));
  const {client}=await session();
  const result=kind==="hours"?await client.rpc("import_operating_months",{p_workspace:workspace,p_key:key,p_rows:hoursRows.parse(input)}):
   kind==="container"?await client.rpc("import_container_months",{p_workspace:workspace,p_key:key,p_rows:containerRows.parse(input)}):
   await client.rpc("import_other_cargo_months",{p_workspace:workspace,p_key:key,p_rows:otherRows.parse(input)});
  if(result.error)return denied();
  revalidatePath("/monthly");revalidatePath("/life");revalidatePath("/reports");revalidatePath("/");
  return {ok:true,message:"Đã lưu "+result.data+" dòng vào đúng bảng độc lập."};
 }catch{return denied();}
}
export async function saveQuick(data:FormData):Promise<ActionResult>{
 try{
  const id=uuid.parse(value(data,"equipment")),key=uuid.parse(value(data,"request_key"));
  const when=actualTimestamp(value(data,"actual_time"));
  const notes=z.string().trim().min(1).max(4000).parse(value(data,"notes"));
  const kind=z.enum(["inspection","fault"]).parse(value(data,"kind")),{client}=await session();
  const result=kind==="inspection"?await client.rpc("submit_quick_inspection",{p_equipment:id,p_when:when,p_notes:notes,p_abnormal:data.get("abnormal")==="on",p_key:key}):
   await client.rpc("report_equipment_fault",{p_equipment:id,p_when:when,p_symptom:notes,p_stopped:data.get("stopped")==="on",p_key:key});
  if(result.error)return denied();revalidatePath("/equipment");revalidatePath("/");
  return {ok:true,message:kind==="inspection"?"Đã gửi phiếu kiểm tra.":"Đã tạo hồ sơ báo hỏng; kỹ thuật cần xác nhận sự cố.",id:result.data};
 }catch{return denied();}
}
export async function convertInspection(data:FormData):Promise<ActionResult>{
 try{const {client}=await session();const result=await client.rpc("convert_inspection_to_repair",{p_case:uuid.parse(value(data,"case"))});
 if(result.error)return denied();revalidatePath("/equipment");return {ok:true,message:"Đã chuyển sang hồ sơ sửa chữa (gửi lại không tạo thêm).",id:result.data};}catch{return denied();}
}
export async function confirmFault(data:FormData):Promise<ActionResult>{
 try{const {client}=await session();const result=await client.from("failure_incidents").update({confirmed:true,primary_cause_group:z.enum(causes).parse(value(data,"cause"))})
 .eq("id",uuid.parse(value(data,"incident"))).select("id").single();
 if(result.error)return denied();revalidatePath("/reports");revalidatePath("/equipment");return {ok:true,message:"Đã xác nhận sự cố và nhóm nguyên nhân."};}catch{return denied();}
}
export async function saveLifeItem(data:FormData):Promise<ActionResult>{
 try{
  const {client}=await session();
  const result=await client.from("equipment_life_items").insert({
   equipment_id:uuid.parse(value(data,"equipment")),slot_code:z.string().trim().min(1).max(40).parse(value(data,"slot")),
   name:z.string().trim().min(1).max(200).parse(value(data,"name")),component_kind:z.enum(["CABLE","CRANE_FRAME_HAMMER","OTHER"]).parse(value(data,"component")),
   installed_at:actualTimestamp(value(data,"installed_at")),installed_meter_hours:z.coerce.number().finite().nonnegative().parse(value(data,"meter")),
   limit_hours:z.coerce.number().finite().positive().parse(value(data,"limit")),warning_hours:z.coerce.number().finite().nonnegative().parse(value(data,"warning"))
  }).select("id").single();
  if(result.error)return denied();revalidatePath("/life");return {ok:true,message:"Đã đăng ký mốc định mức bộ phận."};
 }catch{return denied();}
}

export async function saveSheetSource(data:FormData):Promise<ActionResult>{
 try{
  const {client}=await session(),workspace=uuid.parse(value(data,"workspace"));
  const url=new URL(value(data,"url"));
  if(url.protocol!=="https:" || url.hostname!=="docs.google.com")return denied();
  const match=/^\/spreadsheets\/d\/([A-Za-z0-9_-]{20,150})(?:\/|$)/.exec(url.pathname);if(!match)return denied();
  const kind=z.enum(["container","hours"]).parse(value(data,"source_kind"));
  const start=kind==="hours"?monthStart(value(data,"start_month")):null;
  const {boundedRange}=await import("@/lib/google-sheets");
  const range=boundedRange(value(data,"a1_range") || (kind==="hours"?"A3:AR200":"A3:BH200"));
  if(!range.startsWith("A3:"))return denied();
  const result=await client.from("sheet_sources").insert({source_kind:kind,start_month:start,workspace_id:workspace,name:z.string().trim().min(1).max(100).parse(value(data,"name")),spreadsheet_id:match[1],tab_name:"TH",a1_range:range,equipment_aliases:{}}).select("id").single();
  if(result.error)return denied();revalidatePath("/sheets");return {ok:true,message:"Đã lưu cấu hình nguồn riêng tư; cần cấp quyền Viewer cho kết nối đọc.",id:result.data.id};
 }catch{return denied();}
}
export async function saveGoogleSheet(data:FormData):Promise<ActionResult>{
 try{
  const {previewSource}=await import("@/lib/google-sheets"),{client}=await session();
  const id=uuid.parse(value(data,"source")),key=uuid.parse(value(data,"request_key"));
  const source=await client.from("sheet_sources").select("*").eq("id",id).single();if(source.error)return denied();
  const preview=await previewSource(source.data);
  if(preview.hash!==value(data,"preview_hash"))return {ok:false,message:"Nguồn đã thay đổi sau khi xem trước. Hãy đọc lại và xác nhận phiên bản mới."};
  if(preview.issues.length)return {ok:false,message:"Nguồn có giờ vượt giới hạn tháng; cần đối chiếu rồi đọc lại. Chưa có dòng nào được ghi."};
  if(preview.kind==="hours" && data.get("baseline_confirmed")!=="on")return {ok:false,message:"Cần xác nhận số giờ ban đầu chỉ bao gồm thời gian trước tháng bắt đầu nhập."};
  const args={p_source:id,p_key:key,p_rows:preview.rows};
  const result=preview.kind==="hours"?await client.rpc("sync_hours_source",args):await client.rpc("sync_container_source",args);
  if(result.error)return denied();revalidatePath("/monthly");revalidatePath("/sheets");revalidatePath("/reports");revalidatePath("/life");revalidatePath("/");
  return {ok:true,message:"Đã cập nhật "+result.data+(preview.kind==="hours"?" dòng giờ hoạt động.":" dòng số container (chiếc).")+" Bản chụp lô nhập được lưu trên database cloud."};
 }catch{return {ok:false,message:"Chưa cập nhật được. Kiểm tra kết nối Viewer, mã phương tiện và cấu hình nguồn; không có thay đổi file Google Sheets."};}
}
