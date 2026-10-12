"use server";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {session} from "@/lib/supabase";
import {actualTimestamp,uuid} from "@/lib/domain";
import {actualDay} from "@/lib/monthly-hours";
import {kinds,itemPayload} from "@/lib/followup";
import type {ActionResult} from "./actions";
const field=(data:FormData,key:string)=>String(data.get(key)??"");
const fail=(code?:string):ActionResult=>({ok:false,message:code==="40001"?"Dữ liệu đã thay đổi; tải lại trang trước khi lưu.":"Chưa lưu được. Kiểm tra quyền, ngày thực hiện và trạng thái hồ sơ."});
function refresh(){for(const path of ["/cases","/equipment","/life","/reports","/"])revalidatePath(path,"layout");}
export async function createTrackingCase(data:FormData):Promise<ActionResult>{
 const {client}=await session();
 try{const r=await client.rpc("create_tracking_case",{p_equipment:uuid.parse(field(data,"equipment")),p_kind:z.enum(kinds).parse(field(data,"kind")),
 p_day:actualDay(field(data,"performed_on")),p_summary:z.string().trim().min(1).max(8000).parse(field(data,"summary")),p_key:uuid.parse(field(data,"request_key"))});
 if(r.error)return fail(r.error.code);refresh();return {ok:true,message:"Đã tạo vụ việc; mã theo thời điểm nhập, ngày thực hiện lưu riêng.",id:r.data};}catch{return fail();}
}
export async function saveTrackingItem(data:FormData):Promise<ActionResult>{
 const {client}=await session();
 try{const payload:Record<string,string|null>={};for(const key of Object.keys(itemPayload.shape))payload[key]=key==="performed_on"?(field(data,key)||null):field(data,key);
 const id=field(data,"item"),r=await client.rpc("save_tracking_item",{p_order:uuid.parse(field(data,"order")),p_item:id?uuid.parse(id):null,
 p_version:id?z.coerce.number().int().positive().parse(field(data,"version")):null,p_data:itemPayload.parse(payload),p_key:uuid.parse(field(data,"request_key"))});
 if(r.error)return fail(r.error.code);refresh();return {ok:true,message:"Đã cập nhật hạng mục và lý lịch từ cùng dữ liệu.",id:r.data};}catch{return fail();}
}
export async function addTrackingMaterial(data:FormData):Promise<ActionResult>{
 const {client}=await session();
 try{const r=await client.rpc("add_tracking_material",{p_item:uuid.parse(field(data,"item")),p_material:uuid.parse(field(data,"material")),
 p_quantity:z.coerce.number().finite().positive().parse(field(data,"quantity")),p_supply:z.enum(["planned","borrowed","issued"]).parse(field(data,"supply")),
 p_installed:data.get("installed")==="on",p_position:z.string().max(200).parse(field(data,"position")),p_key:uuid.parse(field(data,"request_key"))});
 if(r.error)return fail(r.error.code);refresh();return {ok:true,message:"Đã thêm vật tư; phần bổ sung mở lại trạng thái trả phiếu nếu trước đó đã hoàn tất.",id:r.data};}catch{return fail();}
}
export async function updateTrackingMaterial(data:FormData):Promise<ActionResult>{
 const {client}=await session();
 try{const r=await client.rpc("update_tracking_material",{p_usage:uuid.parse(field(data,"usage")),p_supply:z.enum(["planned","borrowed","issued"]).parse(field(data,"supply")),p_installed:data.get("installed")==="on"});
 if(r.error)return fail(r.error.code);refresh();return {ok:true,message:"Đã cập nhật; ngày thay lấy từ hạng mục trong lý lịch."};}catch{return fail();}
}
export async function setMaterialReturn(data:FormData):Promise<ActionResult>{
 const {client}=await session();
 try{const status=z.enum(["pending","completed"]).parse(field(data,"return_status")),r=await client.rpc("set_material_return",{
 p_case:uuid.parse(field(data,"case")),p_status:status,p_completed:status==="completed"?actualTimestamp(field(data,"completed_at")):null,
 p_version:z.coerce.number().int().positive().parse(field(data,"version")),p_notes:z.string().max(4000).parse(field(data,"notes"))});
 if(r.error)return fail(r.error.code);refresh();return {ok:true,message:"Đã cập nhật trả phiếu chung; ngày thay không thay đổi."};}catch{return fail();}
}
export async function saveMaterialCatalogue(data:FormData):Promise<ActionResult>{
 const {client}=await session();
 try{const limit=field(data,"limit"),id=field(data,"material"),values={service_limit_hours:limit?z.coerce.number().finite().positive().parse(limit):null,
 service_warning_hours:z.coerce.number().finite().nonnegative().parse(field(data,"warning"))};
 const r=id?await client.from("materials").update(values).eq("id",uuid.parse(id)).select("id").single():
 await client.from("materials").insert({...values,workspace_id:uuid.parse(field(data,"workspace")),code:z.string().trim().min(1).max(50).parse(field(data,"code")),
 name:z.string().trim().min(1).max(200).parse(field(data,"name")),unit:z.string().trim().min(1).max(40).parse(field(data,"unit"))}).select("id").single();
 if(r.error)return fail(r.error.code);refresh();return {ok:true,message:"Đã lưu danh mục/định mức; không phải nhập tồn kho."};}catch{return fail();}
}
