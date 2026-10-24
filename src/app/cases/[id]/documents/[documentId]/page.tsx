import Link from "next/link";
import {notFound} from "next/navigation";
import {session} from "@/lib/supabase";
import {uuid} from "@/lib/domain";
import {snapshotSchema,documentKindLabels} from "@/lib/documents";
import {driveConfigured} from "@/lib/document-drive";
import {DriveArchiveButton} from "@/components/document-editor";
import {ConditionMinutesPaper} from "@/components/condition-minutes-paper";
import {DocumentPrintButton} from "@/components/document-print-button";
export const dynamic="force-dynamic";
export default async function DocumentPage({params}:{params:Promise<{id:string;documentId:string}>}){
 const {id,documentId}=await params;if(!uuid.safeParse(id).success||!uuid.safeParse(documentId).success)notFound();
 const {client}=await session(`/cases/${id}/documents/${documentId}`),r=await client.from("case_documents").select("*").eq("id",documentId).eq("case_id",id).maybeSingle();
 if(r.error)throw new Error("Không đọc được bản xuất.");if(!r.data)notFound();const d=r.data,s=snapshotSchema.parse(d.snapshot);
 const minutes=d.kind==="condition_minutes";
 return <div className="document-page"><h1>{documentKindLabels[d.kind]} · v{d.revision}</h1><p>{s.source.case_code} · {s.source.equipment_code}</p>
 <p>Đây là phiên bản đã lưu. Muốn điều chỉnh nội dung, mở biểu mẫu để sửa và lưu phiên bản tiếp theo; bản này vẫn được giữ nguyên.</p>
 <div className="document-actions"><Link className="button" href={`/cases/${id}/documents?kind=${d.kind}&edit=${d.id}`}>{minutes?"Chỉnh sửa biên bản":"Chỉnh sửa phiếu lĩnh"}</Link><Link className="button button-secondary" href={`/cases/${id}`}>Về vụ việc</Link></div>
 {minutes?<><DocumentPrintButton/><ConditionMinutesPaper payload={s.payload}/></>:<><div className="document-actions"><a className="button" href={`/api/documents/${d.id}/pdf`} target="_blank" rel="noopener noreferrer">Xem / In PDF</a><a href={`/api/documents/${d.id}/pdf?download=1`}>Tải PDF</a></div><p>In A4, tỷ lệ 100%. Phiếu đã ghép hai bản A5: không chọn thêm “2 trang trên một tờ”.</p></>}
 {minutes?<details className="document-history"><summary>PDF tương thích / lưu trữ Drive</summary><p>Bản PDF hệ thống bên dưới dùng font hệ thống cũ. Để có Times New Roman cỡ 13 và bố cục mới, dùng nút In / Lưu PDF phía trên.</p><div className="document-actions"><a href={`/api/documents/${d.id}/pdf`} target="_blank" rel="noopener noreferrer">Xem PDF hệ thống</a><a href={`/api/documents/${d.id}/pdf?download=1`}>Tải PDF hệ thống</a></div></details>:null}
 <section className="panel"><h2>Lưu trữ đám mây</h2><p>Lưu phiên bản lúc {new Date(d.created_at).toLocaleString("vi-VN",{timeZone:"Asia/Bangkok"})}.</p>
 {d.drive_state==="saved"&&d.drive_file_id?<p>Đã lưu PDF trên Drive. <a href={`https://drive.google.com/file/d/${encodeURIComponent(d.drive_file_id)}/view`} target="_blank" rel="noopener noreferrer">Mở tệp Drive</a></p>:<DriveArchiveButton documentId={d.id} configured={driveConfigured(d.workspace_id)}/>}
 <p>Không đổi tiến độ thi công, nghiệm thu, số thực phát hoặc trạng thái trả phiếu khi lưu/in.</p></section></div>;
}
