import Link from "next/link";
import {notFound} from "next/navigation";
import {session} from "@/lib/supabase";
import {uuid} from "@/lib/domain";
import {documentKinds,documentKindLabels} from "@/lib/documents";
import {sourceEnvelopeSchema,editorDocument} from "@/lib/document-source";
import {DocumentEditor} from "@/components/document-editor";
import {minutesDefaults} from "@/lib/document-defaults";
import {prepareRequisition,requisitionBasis} from "@/lib/requisition";
export const dynamic="force-dynamic";
export default async function DocumentsPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{kind?:string;edit?:string}>}){
 const [{id},query]=await Promise.all([params,searchParams]);if(!uuid.safeParse(id).success)notFound();
 if(query.edit&&!uuid.safeParse(query.edit).success)notFound();
 const kind=query.kind==="material_requisition"?"material_requisition":"condition_minutes",{client}=await session(`/cases/${id}/documents?kind=${kind}${query.edit?"&edit="+query.edit:""}`);
 const documentQuery=client.from("case_documents").select("id,snapshot,revision").eq("case_id",id).eq("kind",kind);
 const [source,records,latest]=await Promise.all([
 client.rpc("get_case_document_source",{p_case:id,p_kind:kind}),
 client.from("case_documents").select("id,kind,revision,created_at,drive_state").eq("case_id",id).order("created_at",{ascending:false}),
 (query.edit?documentQuery.eq("id",query.edit):documentQuery.order("created_at",{ascending:false})).limit(1).maybeSingle()]);
 if(source.error)return <><h1>Biểu mẫu & In</h1><p>Chưa đọc được nguồn biểu mẫu. Kiểm tra quyền truy cập hoặc tải lại trang.</p><Link href={`/cases/${id}`}>Về vụ việc</Link></>;
 if(records.error||latest.error)throw new Error("Không đọc được phiên bản biểu mẫu.");
 if(query.edit&&!latest.data)notFound();
 const env=sourceEnvelopeSchema.parse(source.data);
 const basis=kind==="material_requisition"?await requisitionBasis(client,id):undefined;
 const draft=kind==="material_requisition"?prepareRequisition(env,latest.data?.snapshot,basis):editorDocument(env,kind,latest.data?.snapshot);
 const defaults=kind==="condition_minutes"?await minutesDefaults(client,env.workspace_id):undefined;
 return <><h1>Biểu mẫu & In — {env.data.source.case_code}</h1><p>{env.data.source.equipment_code} · Hồ sơ {env.data.source.order_code}</p>
 <div className="mb-5 flex flex-wrap gap-4"><Link href={`/cases/${id}`}>Về vụ việc</Link>{documentKinds.map(k=><Link key={k} href={`/cases/${id}/documents?kind=${k}`}>{documentKindLabels[k]}</Link>)}</div>
 {draft.sourceChanged?<p role="status">{kind==="condition_minutes"?"Vụ việc đã thay đổi. Ngày giờ và nội dung biên bản đã lưu vẫn được giữ riêng để anh chỉnh sửa.":"Nguồn vụ việc đã thay đổi từ lần lưu trước. Kiểm tra lại số liệu nguồn mới; bản đã lưu vẫn được giữ nguyên trong danh sách bên dưới."}</p>:null}
 {query.edit?<p role="status">Đang chỉnh sửa nội dung từ phiên bản v{latest.data?.revision}. Bấm lưu sẽ tạo phiên bản tiếp theo; không ghi đè bản đã lưu.</p>:null}
 <DocumentEditor key={kind+(kind==="condition_minutes"?"":env.source_hash)+(latest.data?.id??"")} caseId={id} sourceHash={env.source_hash} initial={draft.payload} defaults={defaults}/>
 <section className="panel mt-5"><h2>Các phiên bản đã lưu</h2>{records.data?.length?records.data.map(d=><p key={d.id}><Link href={`/cases/${id}/documents/${d.id}`}>{documentKindLabels[d.kind]} · v{d.revision}</Link> · {new Date(d.created_at).toLocaleString("vi-VN",{timeZone:"Asia/Bangkok"})} · {d.drive_state==="saved"?"Đã lưu Drive":"Chưa xác nhận lưu Drive"}</p>):<p>Chưa có phiên bản.</p>}</section></>;
}
