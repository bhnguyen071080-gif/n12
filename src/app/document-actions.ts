"use server";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {session} from "@/lib/supabase";
import {uuid} from "@/lib/domain";
import {decodeDocumentPayload} from "@/lib/documents";
import {sourceEnvelopeSchema,independentMinutes} from "@/lib/document-source";
import {renderDocumentPdf} from "@/lib/document-pdf";
import {archiveCaseDocument} from "@/lib/document-drive";
import type {ActionResult} from "./actions";
export async function saveCaseDocument(form:FormData):Promise<ActionResult>{
 const {client}=await session();
 try{
  if(form.get("reviewed")!=="on")return {ok:false,message:"Kiểm tra thông tin và xác nhận trước khi lưu bản xuất."};
  const payload=independentMinutes(decodeDocumentPayload(String(form.get("payload")??""))),id=uuid.parse(form.get("case"));
  const hash=z.string().regex(/^[a-f0-9]{64}$/).parse(form.get("source_hash"));
  const source=await client.rpc("get_case_document_source",{p_case:id,p_kind:payload.kind});
  if(source.error)return {ok:false,message:"Không có quyền đọc nguồn biểu mẫu."};
  const env=sourceEnvelopeSchema.parse(source.data);
  if(payload.kind!=="condition_minutes"&&env.source_hash!==hash)return {ok:false,message:"Vụ việc đã thay đổi. Tải lại trang để lấy dữ liệu mới trước khi xuất."};
  const saveHash=payload.kind==="condition_minutes"?env.source_hash:hash;
  // Fail before saving when an A5 row cannot fit; never clip a saved PDF silently.
  await renderDocumentPdf({payload,source:env.data.source,source_hash:saveHash,layout_version:"tv-eam-print-1"},1,"2026-01-01T00:00:00Z");
  const result=await client.rpc("save_case_document",{p_case:id,p_kind:payload.kind,p_payload:payload,p_source_hash:saveHash,p_key:uuid.parse(form.get("request_key"))});
  if(result.error)return {ok:false,message:result.error.code==="40001"?(payload.kind==="condition_minutes"?"Vụ việc vừa được cập nhật. Nội dung đang nhập vẫn được giữ; bấm lưu lại để thử lại.":"Nguồn đã thay đổi. Tải lại trang trước khi xuất."):"Chưa lưu được. Kiểm tra quyền và nội dung biểu mẫu."};
  revalidatePath(`/cases/${id}`);revalidatePath(`/cases/${id}/documents`);return {ok:true,id:result.data,message:"Đã lưu phiên bản trên cloud. Trạng thái lĩnh/thay/trả phiếu không thay đổi."};
 }catch(error){return {ok:false,message:error instanceof z.ZodError?error.issues[0]?.message??"Kiểm tra thông tin biểu mẫu.":error instanceof Error&&(error.message.includes("A5")||error.message.includes("font PDF"))?error.message:"Chưa xuất được. Kiểm tra các trường bắt buộc và kết nối."};}
}
export async function saveDocumentToDrive(form:FormData):Promise<ActionResult>{
 const {client,user}=await session();
 try{const id=uuid.parse(form.get("document"));await archiveCaseDocument(client,user.id,id);return {ok:true,message:"Đã lưu PDF lên Google Drive riêng tư."};}
 catch{return {ok:false,message:"Chưa xác nhận lưu trên Drive. Phiên bản cloud vẫn còn; kiểm tra cấu hình/kết nối rồi thử lại, không tạo bản xuất mới."};}
}
