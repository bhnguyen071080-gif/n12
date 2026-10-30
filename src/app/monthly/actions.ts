"use server";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {session} from "@/lib/supabase";
import {parseBaselineForm} from "@/lib/operating-baseline";
import type {ActionResult} from "@/app/actions";
export async function confirmBaseline(data:FormData):Promise<ActionResult>{
 const {client}=await session("/monthly?kind=hours");
 try{
  const v=parseBaselineForm(data);
  const r=await client.rpc("confirm_operating_baseline",{p_equipment:v.equipment,p_hours:v.hours,p_start:v.start,p_key:v.key});
  if(r.error){
   if(r.error.code==="42501")return {ok:false,message:"Chỉ người quản lý khu vực được xác nhận giờ gốc."};
   if(r.error.code==="40001")return {ok:false,message:"Mốc giờ đã được xác nhận. Hãy tải lại trang để xem; không ghi đè mốc đã lưu."};
   return {ok:false,message:"Chưa xác nhận được. Kiểm tra giờ gốc, tháng bắt đầu và các tháng đã nhập; không chọn mốc bỏ qua giờ tháng đã có hoặc đổi giờ gốc cũ."};
  }
  revalidatePath("/monthly");revalidatePath("/catalog");revalidatePath("/equipment","layout");revalidatePath("/life");revalidatePath("/reports");
  return {ok:true,message:"Đã xác nhận giờ gốc và tháng bắt đầu theo dõi. Hệ thống cộng giờ tháng đã ghi nhận đúng một lần.",id:r.data};
 }catch(error){
  if(error instanceof z.ZodError)return {ok:false,message:"Nhập giờ gốc không âm (tối đa hai chữ số thập phân), chọn tháng bắt đầu và xác nhận đã đối chiếu. Không dùng 0 thay cho chưa biết."};
  return {ok:false,message:"Chưa nhận được xác nhận lưu. Kiểm tra kết nối rồi gửi lại cùng nội dung."};
 }
}
