"use server";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {session} from "@/lib/supabase";
import {importKinds,importSpecs,parseImportGrid,rowCells,type ImportPlan,type ImportRow} from "@/lib/table-import";
import {uuid} from "@/lib/domain";
import type {Json} from "@/lib/database";
import type {ActionResult} from "@/app/actions";
function failure(error:{code?:string;message?:string}){
 if(error.code==="42501")return "Bạn không có quyền nhập nhóm dữ liệu này trong khu vực đã chọn.";
 if(error.code==="40001")return "Dữ liệu đã thay đổi sau khi xem trước. Hãy kiểm tra lại tệp để không ghi đè bản mới.";
 return error.code==="22023"&&error.message?.startsWith("TVEAM:")?error.message.slice(7,307):"Không nhập được. Kiểm tra mã, tháng, số liệu và kết nối. Chưa có dòng nào trong lô này được ghi.";
}
function validateRows(kind:typeof importKinds[number],raw:unknown):ImportRow[]{
 const a=z.array(z.record(z.union([z.string(),z.number().finite(),z.null(),z.array(z.string())]))).min(1).max(500).parse(raw);
 // The same canonical parser runs again server-side; unrecognized keys are rejected below by SQL.
 const parsed=parseImportGrid([importSpecs[kind].headers,...a.map(r=>rowCells(r,kind))],kind);
 if(parsed.issues.length)throw Error("validation");
 if(JSON.stringify(parsed.rows).length>250000)throw Error("size");
 return parsed.rows;
}
export async function previewTable(data:FormData):Promise<ActionResult & {plan?:ImportPlan[]}>{
 const {client}=await session("/imports");
 try{
  const workspace=uuid.parse(String(data.get("workspace"))),kind=z.enum(importKinds).parse(data.get("kind"));
  const rows=validateRows(kind,JSON.parse(z.string().max(250000).parse(data.get("rows"))));
  const r=await client.rpc("preview_import_table",{p_workspace:workspace,p_kind:kind,p_rows:rows as Json});
  if(r.error)return {ok:false,message:failure(r.error)};
  return {ok:true,message:"Đã kiểm tra với dữ liệu hiện có. Chưa lưu dòng nào.",plan:r.data as unknown as ImportPlan[]};
 }catch{return {ok:false,message:"Tệp có dữ liệu không hợp lệ hoặc quá lớn. Kiểm tra lại trước khi nhập."};}
}
export async function commitTable(data:FormData):Promise<ActionResult>{
 const {client}=await session("/imports");
 try{
  const workspace=uuid.parse(String(data.get("workspace"))),key=uuid.parse(String(data.get("request_key"))),kind=z.enum(importKinds).parse(data.get("kind"));
  const mode=z.enum(["add","replace"]).parse(data.get("mode"));
  if(mode==="replace"&&data.get("confirmed")!=="on")return {ok:false,message:"Cần xác nhận thay số liệu hoặc thông tin đã có."};
  const plan=z.array(z.object({row:z.record(z.unknown()),expected:z.record(z.unknown()).nullable()})).min(1).max(500).parse(JSON.parse(z.string().max(750000).parse(data.get("plan"))));
  const rows=validateRows(kind,plan.map(p=>p.row));
  const payload=plan.map((p,i)=>({row:rows[i],expected:p.expected}));
  const r=await client.rpc("import_table_batch",{p_workspace:workspace,p_kind:kind,p_mode:mode,p_plan:payload as Json,p_key:key});
  if(r.error)return {ok:false,message:failure(r.error)};
  for(const path of ["/imports","/catalog","/materials","/monthly","/life","/reports","/"])revalidatePath(path);
  revalidatePath("/equipment","layout");
  return {ok:true,message:"Đã nhập "+r.data+" dòng. Dòng không có trong tệp được giữ nguyên; gửi lại cùng yêu cầu không tạo bản sao hoặc cộng lại giờ."};
 }catch{return {ok:false,message:"Không nhập được lô dữ liệu. Hãy kiểm tra lại tệp và kết nối; chưa có xác nhận lưu."};}
}
