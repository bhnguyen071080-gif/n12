"use server";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import type {ActionResult} from "@/app/actions";
import {session} from "@/lib/supabase";
import {uuid} from "@/lib/domain";

const quality=z.enum(["pending","accepted","conditional","rejected"]);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const text=(max:number)=>z.string().trim().max(max);

export async function saveContractorMaterial(data:FormData):Promise<ActionResult>{
 const {client}=await session("/contractor-materials");
 try{
  const workspace=uuid.parse(data.get("workspace")),requestKey=uuid.parse(data.get("request_key")),qualityStatus=quality.parse(data.get("quality_status"));
  const qualityDate=String(data.get("quality_checked_on")??"");
  const row={workspace_id:workspace,equipment_id:uuid.parse(data.get("equipment_id")),material_name:z.string().trim().min(1).max(300).parse(data.get("material_name")),unit:z.string().trim().min(1).max(40).parse(data.get("unit")),quantity:z.coerce.number().positive().max(1000000).parse(data.get("quantity")),contractor_name:text(200).parse(data.get("contractor_name")),signed_on:date.parse(data.get("signed_on")),warranty_months:z.coerce.number().int().min(0).max(120).parse(data.get("warranty_months")),quality_status:qualityStatus,quality_checked_on:qualityStatus==="pending"?null:date.parse(qualityDate),quality_note:text(1000).parse(data.get("quality_note")),notes:text(1000).parse(data.get("notes")),request_key:requestKey};
  const saved=await client.from("contractor_materials").insert(row).select("id").single();
  if(saved.error){
   if(saved.error.code==="23505"){
    const retry=await client.from("contractor_materials").select("id").eq("workspace_id",workspace).eq("request_key",requestKey).maybeSingle();
    if(retry.data)return {ok:true,message:"Dòng vật tư này đã được lưu ở lần gửi trước; hệ thống không tạo trùng."};
   }
   if(saved.error.code==="42501")return {ok:false,message:"Bạn chưa có quyền ghi nhận vật tư nhà thầu trong khu vực này."};
   if(saved.error.code==="23503"||saved.error.code==="22023")return {ok:false,message:"Phương tiện không thuộc khu vực đang chọn hoặc dữ liệu thời hạn không hợp lệ."};
   return {ok:false,message:"Chưa lưu được vật tư nhà thầu. Kiểm tra dữ liệu và kết nối rồi thử lại."};
  }
  revalidatePath("/contractor-materials");return {ok:true,message:"Đã lưu vật tư nhà thầu và thiết lập theo dõi thời hạn."};
 }catch{return {ok:false,message:"Kiểm tra tên vật tư, số lượng, ngày ký, tháng bảo hành và kết quả chất lượng."};}
}

export async function updateContractorMaterialQuality(data:FormData):Promise<ActionResult>{
 const {client}=await session("/contractor-materials");
 try{
  const workspace=uuid.parse(data.get("workspace")),id=uuid.parse(data.get("id")),status=quality.parse(data.get("quality_status"));
  const checked=String(data.get("quality_checked_on")??"");
  const result=await client.from("contractor_materials").update({quality_status:status,quality_checked_on:status==="pending"?null:date.parse(checked),quality_note:text(1000).parse(data.get("quality_note"))}).eq("id",id).eq("workspace_id",workspace).select("id").maybeSingle();
  if(result.error){if(result.error.code==="42501")return {ok:false,message:"Bạn chưa có quyền cập nhật kết quả chất lượng."};return {ok:false,message:"Chưa cập nhật được kết quả kiểm tra chất lượng."};}
  if(!result.data)return {ok:false,message:"Không tìm thấy dòng vật tư trong khu vực đang chọn."};
  revalidatePath("/contractor-materials");return {ok:true,message:"Đã cập nhật kết quả kiểm tra chất lượng."};
 }catch{return {ok:false,message:"Chọn trạng thái và ngày kiểm tra hợp lệ."};}
}

