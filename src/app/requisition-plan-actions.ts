"use server";
import {revalidatePath} from "next/cache";
import {uuid} from "@/lib/domain";
import {session} from "@/lib/supabase";
import {savePlanInputSchema,resolvePlanRows,planVoucherPayload,savedPlanVouchers,type SavedRequisitionPlan} from "@/lib/saved-requisition-plan";
import type {Json} from "@/lib/database";
import type {ActionResult} from "./actions";
import {renderPlanVoucherPdf} from "@/lib/document-pdf";

export async function saveRequisitionPlan(data:FormData):Promise<ActionResult>{
 try{
  if(data.get("confirmed")!=="on")return {ok:false,message:"Xác nhận đã đối chiếu phương tiện và số lượng trước khi lưu."};
  const workspace=uuid.parse(data.get("workspace")),key=uuid.parse(data.get("request_key"));
  const raw=String(data.get("plan")??"");if(raw.length>50000)throw new Error("Dữ liệu quá lớn");
  const input=savePlanInputSchema.parse(JSON.parse(raw)),{client}=await session();
  const result=await client.from("equipment").select("id,code,name").eq("workspace_id",workspace).neq("base_status","decommissioned");
  if(result.error)throw new Error("Không đọc được danh mục");
  const rows=resolvePlanRows(input,result.data??[]);
  const draft={planned_day:input.plannedDay,grouping_mode:input.grouping,snapshot:{version:1,rows,print:input.print}} as SavedRequisitionPlan;
  for(const voucher of savedPlanVouchers(draft))planVoucherPayload(draft,voucher);
  // Check all material/header glyphs and the largest combined vouchers before
  // committing. At most two renders even when saving 57 equipment vouchers.
  for(const voucher of savedPlanVouchers({...draft,grouping_mode:"date"}))await renderPlanVoucherPdf(planVoucherPayload(draft,voucher),key,new Date().toISOString());
  const saved=await client.rpc("save_maintenance_requisition",{p_workspace:workspace,p_key:key,p_day:input.plannedDay,p_grouping:input.grouping,p_rows:JSON.parse(JSON.stringify(rows)) as Json,p_print:input.print});
  if(saved.error)return {ok:false,message:"Chưa lưu kế hoạch. Kiểm tra quyền kỹ thuật, mã phương tiện và ngày. Gửi lại cùng dữ liệu không tạo trùng."};
  revalidatePath("/requisitions");revalidatePath("/equipment");revalidatePath("/");
  return {ok:true,message:"Đã lưu kế hoạch và liên kết vụ việc. Mở kế hoạch đã lưu để tải phiếu BM.08.06.",id:saved.data};
 }catch{return {ok:false,message:"Chưa lưu. Đối chiếu đủ phương tiện, chọn ngày hợp lệ và nhập đơn vị lập phiếu."};}
}
