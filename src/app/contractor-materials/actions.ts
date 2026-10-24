"use server";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import type {ActionResult} from "@/app/actions";
import {session} from "@/lib/supabase";
import {uuid} from "@/lib/domain";

const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const text=(max:number)=>z.string().trim().max(max);

export async function saveContractorMaterial(data:FormData):Promise<ActionResult>{
 const {client}=await session("/contractor-materials");
 try{
  const workspace=uuid.parse(data.get("workspace")),requestKey=uuid.parse(data.get("request_key"));
  const row={workspace_id:workspace,equipment_id:uuid.parse(data.get("equipment_id")),material_name:z.string().trim().min(1).max(300).parse(data.get("material_name")),unit:z.string().trim().min(1).max(40).parse(data.get("unit")),quantity:z.coerce.number().positive().max(1000000).parse(data.get("quantity")),contractor_name:text(200).parse(data.get("contractor_name")),signed_on:date.parse(data.get("signed_on")),warranty_months:z.coerce.number().int().min(0).max(120).parse(data.get("warranty_months")),notes:text(1000).parse(data.get("notes")),request_key:requestKey};
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
 }catch{return {ok:false,message:"Kiểm tra tên vật tư, số lượng, ngày ký và tháng bảo hành."};}
}

