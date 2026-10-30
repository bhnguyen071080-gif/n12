import {NextRequest,NextResponse} from "next/server";
import {configured,serverClient} from "@/lib/supabase";
import {uuid} from "@/lib/domain";
import {snapshotSchema,documentFilename} from "@/lib/documents";
import {renderDocumentPdf} from "@/lib/document-pdf";
import {readArchivedPdf} from "@/lib/document-drive";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!uuid.safeParse(id).success)return NextResponse.json({error:"Sai định danh"},{status:400});
 if(!configured())return NextResponse.json({error:"Chưa kết nối cloud"},{status:503});
 const client=await serverClient(),auth=await client.auth.getUser();if(auth.error||!auth.data.user)return NextResponse.json({error:"Cần đăng nhập"},{status:401});
 const r=await client.from("case_documents").select("*").eq("id",id).maybeSingle();
 if(r.error)return NextResponse.json({error:"Không đọc được bản xuất"},{status:503});if(!r.data)return NextResponse.json({error:"Không tìm thấy bản xuất"},{status:404});
 try{const d=r.data,s=snapshotSchema.parse(d.snapshot),pdf=d.drive_state==="saved"?await readArchivedPdf(d):await renderDocumentPdf(s,d.revision,d.created_at);
 return new NextResponse(new Uint8Array(pdf),{headers:{"Content-Type":"application/pdf","Cache-Control":"private, no-store, max-age=0","Content-Disposition":`${request.nextUrl.searchParams.get("download")==="1"?"attachment":"inline"}; filename="${documentFilename(s.source,d.kind,d.revision)}"`}});
 }catch{return NextResponse.json({error:"Không tạo/đọc được PDF. Không tự thay bản đã lưu Drive bằng nội dung mới."},{status:422});}
}
