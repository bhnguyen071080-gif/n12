"use server";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {session} from "@/lib/supabase";
import {uuid,equipmentCode} from "@/lib/domain";
import {parseMaterialCategory,materialCategory} from "@/lib/material-catalog";
import type {ActionResult} from "@/app/actions";
const expectedSchema=z.object({id:uuid,name:z.string().min(1).max(200),unit:z.string().min(1).max(40),equipment_category:materialCategory.nullable()}).strict().nullable();
export async function saveMaterial(data:FormData):Promise<ActionResult>{
 const {client}=await session("/materials");
 try{
  const workspace=uuid.parse(data.get("workspace")),key=uuid.parse(data.get("request_key"));
  const row={code:equipmentCode.parse(String(data.get("code")??"").trim().toUpperCase()),name:z.string().trim().min(1).max(200).parse(data.get("name")),unit:z.string().trim().min(1).max(40).parse(data.get("unit")),equipment_category:parseMaterialCategory(String(data.get("equipment_category")??""))};
  const expected=expectedSchema.parse(JSON.parse(z.string().max(2000).parse(data.get("expected"))));
  // Reuse atomic, permission-checked import for one manually entered row. The original
  // snapshot and request key stay identical on retry; no pre-read can race the write.
  const r=await client.rpc("import_table_batch",{p_workspace:workspace,p_kind:"materials",p_mode:expected?"replace":"add",p_plan:[{row,expected}],p_key:key});
  if(r.error){
   if(r.error.code==="40001")return {ok:false,message:"Vật tư đã thay đổi sau khi mở biểu mẫu. Tải lại danh sách trước khi sửa; chưa ghi đè dữ liệu."};
   if(r.error.code==="42501")return {ok:false,message:"Bạn chưa có quyền thêm hoặc sửa vật tư trong khu vực này."};
   if(r.error.code==="23505")return {ok:false,message:"Mã vật tư đã có. Hãy chọn Sửa tại dòng đó."};
   return {ok:false,message:r.error.code==="22023"&&r.error.message?.startsWith("TVEAM:")?r.error.message.slice(7,307):"Chưa lưu được vật tư. Kiểm tra mã, đơn vị và kết nối; không tự đổi đơn vị của mã đã có."};
  }
  revalidatePath("/materials");revalidatePath("/cases");revalidatePath("/life");revalidatePath("/imports");
  return {ok:true,message:expected?"Đã cập nhật vật tư. Tồn kho và định mức giữ nguyên.":"Đã thêm vật tư vào danh mục. Chưa tạo tồn kho hoặc phiếu kho."};
 }catch{return {ok:false,message:"Kiểm tra mã, tên, đơn vị và loại phương tiện trước khi lưu. Chưa có xác nhận ghi dữ liệu."};}
}
