import "server-only";
import {createHash} from "node:crypto";
import {OAuth2Client} from "google-auth-library";
import {createClient,type SupabaseClient} from "@supabase/supabase-js";
import {z} from "zod";
import type {Database} from "./database";
import {snapshotSchema,documentFilename,type CaseDocument} from "./documents";
import {renderDocumentPdf} from "./document-pdf";

const fileId=z.string().regex(/^[A-Za-z0-9_-]{10,200}$/);
const claimSchema=z.object({id:z.guid(),workspace_id:z.guid(),kind:z.enum(["condition_minutes","material_requisition"]),
 revision:z.number().int().positive(),created_at:z.string(),snapshot:snapshotSchema,drive_file_id:fileId,
 drive_state:z.enum(["pending","uploading","saved"]),drive_lease:z.guid().nullable()});
const fileSchema=z.object({id:fileId,trashed:z.boolean().optional(),parents:z.array(z.string()),size:z.string(),appProperties:z.record(z.string(),z.string())});
const folderMap=()=>z.record(z.string(),fileId).parse(JSON.parse(process.env.GOOGLE_DRIVE_FOLDERS??"{}") as unknown);
export function driveConfigured(workspace:string):boolean{
 try{return Boolean(process.env.GOOGLE_DRIVE_CLIENT_ID&&process.env.GOOGLE_DRIVE_CLIENT_SECRET&&process.env.GOOGLE_DRIVE_REFRESH_TOKEN&&process.env.SUPABASE_SERVICE_ROLE_KEY&&folderMap()[workspace]);}catch{return false;}
}
async function accessToken():Promise<string>{
 const client=new OAuth2Client(process.env.GOOGLE_DRIVE_CLIENT_ID,process.env.GOOGLE_DRIVE_CLIENT_SECRET);
 client.setCredentials({refresh_token:process.env.GOOGLE_DRIVE_REFRESH_TOKEN});
 const token=await client.getAccessToken();if(!token.token)throw new Error("Google connection expired");return token.token;
}
async function request(token:string,url:string,init:RequestInit={}):Promise<Response>{
 return fetch(url,{...init,redirect:"error",cache:"no-store",signal:AbortSignal.timeout(45000),headers:{...init.headers,Authorization:`Bearer ${token}`}});
}
async function assertPrivateFolder(token:string,folder:string):Promise<void>{
 const r=await request(token,`https://www.googleapis.com/drive/v3/files/${folder}?fields=id,mimeType,trashed,permissions(type)`);
 if(!r.ok)throw new Error("Drive folder inaccessible");
 const value:unknown=await r.json();const data=z.object({id:fileId,mimeType:z.literal("application/vnd.google-apps.folder"),trashed:z.boolean().optional(),permissions:z.array(z.object({type:z.string()}))}).parse(value);
 if(data.trashed||data.permissions.some(p=>p.type==="anyone"||p.type==="domain"))throw new Error("Archive folder must not be public/domain shared");
}
async function verifyFile(token:string,id:string,folder:string,documentId:string,sha:string):Promise<void>{
 const r=await request(token,`https://www.googleapis.com/drive/v3/files/${id}?fields=id,parents,trashed,size,appProperties`);
 if(!r.ok)throw new Error("Drive file inaccessible");const data=fileSchema.parse(await r.json());
 if(data.trashed||!data.parents.includes(folder)||data.appProperties.tv_eam_document!==documentId||data.appProperties.pdf_sha256!==sha)throw new Error("Archive identity mismatch");
 // Verify actual bytes, not just caller-editable metadata.
 if(!/^\d+$/.test(data.size)||Number(data.size)>10000000)throw new Error("Archive size invalid");
 const bytes=await request(token,`https://www.googleapis.com/drive/v3/files/${id}?alt=media`);
 if(!bytes.ok)throw new Error("Archive download failed");
 if(createHash("sha256").update(Buffer.from(await bytes.arrayBuffer())).digest("hex")!==sha)throw new Error("Archive checksum mismatch");
}
export async function archiveCaseDocument(client:SupabaseClient<Database>,actor:string,id:string):Promise<void>{
 const read=await client.from("case_documents").select("*").eq("id",id).maybeSingle();
 if(read.error||!read.data)throw new Error("Document denied");const original=read.data;
 if(!driveConfigured(original.workspace_id))throw new Error("Drive not configured");
 const token=await accessToken(),folder=folderMap()[original.workspace_id];await assertPrivateFolder(token,folder);
 if(original.drive_state==="saved"){
  if(!original.drive_file_id||!original.drive_pdf_sha256)throw new Error("Missing archive reference");
  await verifyFile(token,original.drive_file_id,folder,id,original.drive_pdf_sha256);return;
 }
 const generated=await request(token,"https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=drive&type=files");
 if(!generated.ok)throw new Error("Drive ID generation failed");
 const ids=z.object({ids:z.array(fileId).length(1)}).parse(await generated.json());
 const result=await client.rpc("claim_document_drive",{p_document:id,p_file_id:ids.ids[0]});
 if(result.error)throw new Error("Archive lease unavailable");const d=claimSchema.parse(result.data);
 if(d.drive_state==="saved")return;
 if(!d.drive_lease)throw new Error("Missing archive lease");
 try{
  const pdf=await renderDocumentPdf(d.snapshot,d.revision,d.created_at),sha=createHash("sha256").update(pdf).digest("hex");
  const boundary=`tv-eam-${d.drive_lease}`,meta={id:d.drive_file_id,name:documentFilename(d.snapshot.source,d.kind,d.revision),parents:[folder],mimeType:"application/pdf",appProperties:{tv_eam_document:id,pdf_sha256:sha}};
  const body=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`),Buffer.from(pdf),Buffer.from(`\r\n--${boundary}--\r\n`)]);
  const upload=await request(token,"https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",{method:"POST",headers:{"Content-Type":`multipart/related; boundary=${boundary}`},body});
  if(!upload.ok&&upload.status!==409)throw new Error("Upload not confirmed");
  await verifyFile(token,d.drive_file_id,folder,id,sha);
  const admin=createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
  const finished=await admin.rpc("finish_document_drive",{p_document:id,p_lease:d.drive_lease,p_sha256:sha,p_actor:actor});
  if(finished.error)throw new Error("Archive finalization failed");
 }catch(error){await client.rpc("release_document_drive",{p_document:id,p_lease:d.drive_lease});throw error;}
}
export async function readArchivedPdf(d:CaseDocument):Promise<Uint8Array>{
 if(!driveConfigured(d.workspace_id)||!d.drive_file_id||!d.drive_pdf_sha256)throw new Error("Archive unavailable");
 const token=await accessToken(),folder=folderMap()[d.workspace_id];await assertPrivateFolder(token,folder);
 await verifyFile(token,d.drive_file_id,folder,d.id,d.drive_pdf_sha256);
 const r=await request(token,`https://www.googleapis.com/drive/v3/files/${d.drive_file_id}?alt=media`);
 if(!r.ok)throw new Error("Archive download failed");const data=new Uint8Array(await r.arrayBuffer());
 if(createHash("sha256").update(data).digest("hex")!==d.drive_pdf_sha256)throw new Error("Archive changed during read");return data;
}
