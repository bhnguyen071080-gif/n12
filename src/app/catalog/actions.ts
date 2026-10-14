"use server";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {session} from "@/lib/supabase";
import {parseCatalogForm} from "@/lib/equipment-catalog";
import type {ActionResult} from "@/app/actions";
export async function saveEquipment(data:FormData):Promise<ActionResult>{
 const {client}=await session("/catalog");
 try{
  const v=parseCatalogForm(data);
  const r=await client.rpc("save_equipment_catalog",{p_workspace:v.workspace,p_id:v.id,p_version:v.version,p_key:v.key,p_code:v.code,p_name:v.name,p_category:v.category,p_base_status:v.base_status,p_serial:v.serial,p_year:v.year,p_notes:v.notes,p_aliases:v.aliases,p_initial_hours:v.initial_hours});
  if(r.error){
   if(r.error.code==="23505")return {ok:false,message:"Mã phương tiện đã tồn tại trong khu vực này. Hãy mở bản có sẵn để sửa."};
   if(r.error.code==="40001")return {ok:false,message:"Có người vừa sửa danh mục này. Hãy tải lại trang trước khi tiếp tục; dữ liệu của bạn chưa ghi đè."};
   if(r.error.code==="42501")return {ok:false,message:"Bạn không có quyền quản lý danh mục trong khu vực đang chọn."};
   return {ok:false,message:"Chưa lưu được. Kiểm tra mã, thông tin, giờ ban đầu và kết nối; gửi lại cùng dữ liệu không tạo thêm phương tiện."};
  }
  revalidatePath("/catalog");revalidatePath("/");revalidatePath("/equipment/"+v.code);revalidatePath("/monthly");revalidatePath("/cases");
  return {ok:true,message:v.id?"Đã cập nhật thông tin phương tiện; mã và giờ ban đầu được giữ nguyên.":"Đã thêm phương tiện. Giờ ban đầu đã lưu theo số bạn xác nhận.",id:r.data};
 }catch(error){
  if(error instanceof z.ZodError){
   const labels:Record<string,string>={workspace:"khu vực dữ liệu",id:"phương tiện",version:"phiên bản",key:"mã lần lưu",code:"mã phương tiện",name:"tên phương tiện",category:"loại thiết bị",base_status:"trạng thái nền",serial:"số chế tạo",year:"năm sản xuất",notes:"ghi chú",aliases:"mã tham chiếu",initial_hours:"giờ ban đầu",confirmed:"xác nhận giờ ban đầu"};
   return {ok:false,message:"Thông tin chưa hợp lệ: "+(labels[String(error.issues[0]?.path[0])]??"biểu mẫu")+". Kiểm tra lại trước khi lưu."};
  }
  return {ok:false,message:"Chưa kết nối được để lưu danh mục. Dữ liệu chưa được xác nhận lưu; có thể gửi lại cùng nội dung."};
 }
}
