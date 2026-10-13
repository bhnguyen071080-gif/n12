import Link from "next/link";
import {notFound} from "next/navigation";
import {session} from "@/lib/supabase";
import {uuid} from "@/lib/domain";
import {snapshotSchema,documentKindLabels} from "@/lib/documents";
import {driveConfigured} from "@/lib/document-drive";
import {DriveArchiveButton} from "@/components/document-editor";
export const dynamic="force-dynamic";
export default async function DocumentPage({params}:{params:Promise<{id:string;documentId:string}>}){
 const {id,documentId}=await params;if(!uuid.safeParse(id).success||!uuid.safeParse(documentId).success)notFound();
 const {client}=await session(`/cases/${id}/documents/${documentId}`),r=await client.from("case_documents").select("*").eq("id",documentId).eq("case_id",id).maybeSingle();
 if(r.error)throw new Error("Không đọc được bản xuất.");if(!r.data)notFound();const d=r.data,s=snapshotSchema.parse(d.snapshot);
 return <><h1>{documentKindLabels[d.kind]} · v{d.revision}</h1><p>{s.source.case_code} · {s.source.equipment_code}</p>
 <p>Đây là phiên bản cố định. Sửa nguồn vụ việc không làm đổi nội dung phiên bản đã lưu; muốn thay đổi, lập phiên bản mới.</p>
 <div className="my-4 flex flex-wrap gap-4"><a className="button" href={`/api/documents/${d.id}/pdf`} target="_blank" rel="noopener noreferrer">Xem / In PDF</a>
 <a href={`/api/documents/${d.id}/pdf?download=1`}>Tải PDF</a><Link href={`/cases/${id}/documents?kind=${d.kind}`}>Lập phiên bản mới</Link></div>
 <p>In A4, tỷ lệ 100% / kích thước thực. Phiếu đã ghép hai bản A5: không chọn thêm “2 trang trên một tờ”.</p>
 <section className="panel"><h2>Lưu trữ đám mây</h2><p>Lưu phiên bản lúc {new Date(d.created_at).toLocaleString("vi-VN",{timeZone:"Asia/Bangkok"})}.</p>
 {d.drive_state==="saved"&&d.drive_file_id?<p>Đã lưu PDF trên Drive. <a href={`https://drive.google.com/file/d/${encodeURIComponent(d.drive_file_id)}/view`} target="_blank" rel="noopener noreferrer">Mở tệp Drive</a></p>:<DriveArchiveButton documentId={d.id} configured={driveConfigured(d.workspace_id)}/>}
 <p>Không đổi tiến độ thi công, nghiệm thu, số thực phát hoặc trạng thái trả phiếu khi lưu/in.</p></section></>;
}
