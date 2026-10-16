import Link from "next/link";
import {notFound} from "next/navigation";
import {session} from "@/lib/supabase";
import {uuid} from "@/lib/domain";
import {documentKinds,documentKindLabels} from "@/lib/documents";
import {sourceEnvelopeSchema,editorDocument} from "@/lib/document-source";
import {DocumentEditor} from "@/components/document-editor";
export const dynamic="force-dynamic";
export default async function DocumentsPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{kind?:string}>}){
 const [{id},query]=await Promise.all([params,searchParams]);if(!uuid.safeParse(id).success)notFound();
 const kind=query.kind==="material_requisition"?"material_requisition":"condition_minutes",{client}=await session(`/cases/${id}/documents?kind=${kind}`);
 const [source,records,latest]=await Promise.all([
 client.rpc("get_case_document_source",{p_case:id,p_kind:kind}),
 client.from("case_documents").select("id,kind,revision,created_at,drive_state").eq("case_id",id).order("created_at",{ascending:false}),
 client.from("case_documents").select("id,snapshot").eq("case_id",id).eq("kind",kind).order("created_at",{ascending:false}).limit(1).maybeSingle()]);
 if(source.error)return <><h1>Biểu mẫu & In</h1><p>Chưa đọc được nguồn biểu mẫu. Kiểm tra quyền truy cập hoặc tải lại trang.</p><Link href={`/cases/${id}`}>Về vụ việc</Link></>;
 if(records.error||latest.error)throw new Error("Không đọc được phiên bản biểu mẫu.");
 const env=sourceEnvelopeSchema.parse(source.data),draft=editorDocument(env,kind,latest.data?.snapshot);
 return <><h1>Biểu mẫu & In — {env.data.source.case_code}</h1><p>{env.data.source.equipment_code} · Hồ sơ {env.data.source.order_code}</p>
 <div className="mb-5 flex flex-wrap gap-4"><Link href={`/cases/${id}`}>Về vụ việc</Link>{documentKinds.map(k=><Link key={k} href={`/cases/${id}/documents?kind=${k}`}>{documentKindLabels[k]}</Link>)}</div>
 {draft.sourceChanged?<p role="status">Nguồn vụ việc đã thay đổi từ lần lưu trước. Kiểm tra lại số liệu nguồn mới; bản đã lưu vẫn được giữ nguyên trong danh sách bên dưới.</p>:null}
 <DocumentEditor key={kind+env.source_hash+(latest.data?.id??"")} caseId={id} sourceHash={env.source_hash} initial={draft.payload}/>
 <section className="panel mt-5"><h2>Các phiên bản đã lưu</h2>{records.data?.length?records.data.map(d=><p key={d.id}><Link href={`/cases/${id}/documents/${d.id}`}>{documentKindLabels[d.kind]} · v{d.revision}</Link> · {new Date(d.created_at).toLocaleString("vi-VN",{timeZone:"Asia/Bangkok"})} · {d.drive_state==="saved"?"Đã lưu Drive":"Chưa xác nhận lưu Drive"}</p>):<p>Chưa có phiên bản.</p>}</section></>;
}
