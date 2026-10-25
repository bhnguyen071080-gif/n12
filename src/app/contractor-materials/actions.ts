"use server";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import type {ActionResult} from "@/app/actions";
import {session} from "@/lib/supabase";
import {uuid} from "@/lib/domain";
import {randomUUID} from "node:crypto";
import {normalizeLookup,type ContractorImportRow} from "@/lib/contractor-materials";

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

const importRow=z.object({line:z.number().int().positive(),source_no:z.string().min(1).max(50),material_name:z.string().trim().min(1).max(300),unit:z.string().trim().min(1).max(40),quantity:z.number().positive().max(1000000),equipment_code:z.string().max(80),equipment_name:z.string().max(200),signed_on:date,warranty_months:z.number().int().min(0).max(120),notes:z.string().max(1000)}).strict();
const identity=(row:{equipment_id:string;material_name:string;unit:string;quantity:number;signed_on:string;warranty_months:number;notes:string})=>[row.equipment_id,normalizeLookup(row.material_name),normalizeLookup(row.unit),row.quantity.toFixed(3),row.signed_on,row.warranty_months,normalizeLookup(row.notes)].join("|");

export async function importContractorMaterials(data:FormData):Promise<ActionResult>{
 const {client}=await session("/contractor-materials");
 try{
  if(data.get("confirmed")!=="on")return {ok:false,message:"Cần xác nhận đã kiểm tra bản xem trước."};
  const workspace=uuid.parse(data.get("workspace")),rows=z.array(importRow).min(1).max(2000).parse(JSON.parse(z.string().max(1500000).parse(data.get("rows")))) as ContractorImportRow[];
  const [equipment,existing]=await Promise.all([client.from("equipment").select("id,code,name").eq("workspace_id",workspace),client.from("contractor_materials").select("equipment_id,material_name,unit,quantity,signed_on,warranty_months,notes").eq("workspace_id",workspace).limit(10000)]);
  if(equipment.error||existing.error)return {ok:false,message:"Không đọc được dữ liệu hiện có để đối chiếu trước khi nhập."};
  const byName=new Map(equipment.data.map(item=>[normalizeLookup(item.name),item])),byCode=new Map(equipment.data.map(item=>[normalizeLookup(item.code),item]));
  const known=new Set(existing.data.map(item=>identity({...item,quantity:Number(item.quantity)}))),insert:{workspace_id:string;equipment_id:string;material_name:string;unit:string;quantity:number;contractor_name:string;signed_on:string;warranty_months:number;notes:string;request_key:string}[]=[],unknown:string[]=[];
  for(const row of rows){const machine=byName.get(normalizeLookup(row.equipment_name))??byCode.get(normalizeLookup(row.equipment_code));if(!machine){unknown.push(`dòng ${row.line}: ${row.equipment_name||row.equipment_code}`);continue;}
   const prepared={workspace_id:workspace,equipment_id:machine.id,material_name:row.material_name,unit:row.unit,quantity:row.quantity,contractor_name:"",signed_on:row.signed_on,warranty_months:row.warranty_months,notes:row.notes,request_key:randomUUID()};const key=identity(prepared);if(known.has(key))continue;known.add(key);insert.push(prepared);}
  if(unknown.length)return {ok:false,message:"Chưa khớp phương tiện: "+unknown.slice(0,12).join("; ")+(unknown.length>12?`… và ${unknown.length-12} dòng khác.`:"")+" Hệ thống ưu tiên tên phương tiện, sau đó mới dùng mã gõ tắt."};
  if(!insert.length)return {ok:true,message:"Tất cả dòng trong tệp đã có; hệ thống không tạo trùng."};
  const saved=await client.from("contractor_materials").insert(insert).select("id");if(saved.error)return {ok:false,message:saved.error.code==="42501"?"Bạn chưa có quyền nhập vật tư nhà thầu.":"Chưa nhập được lô dữ liệu; chưa có dòng nào được ghi."};
  revalidatePath("/contractor-materials");return {ok:true,message:`Đã nhập ${saved.data.length} dòng; các dòng trùng hoàn toàn được giữ nguyên, không nhân đôi.`};
 }catch{return {ok:false,message:"Tệp nhập không hợp lệ hoặc quá lớn; kiểm tra lại mẫu VT_DVSC."};}
}

