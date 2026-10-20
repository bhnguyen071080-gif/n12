import Link from "next/link";
import type {SupabaseClient} from "@supabase/supabase-js";
import type {Database} from "@/lib/database";
import {documentKinds,documentKindLabels,type DocumentPayload} from "@/lib/documents";
import {sourceEnvelopeSchema,editorDocument} from "@/lib/document-source";
import {DocumentEditor} from "./document-editor";
import {minutesDefaults} from "@/lib/document-defaults";
import {prepareRequisition,requisitionBasis} from "@/lib/requisition";

export async function CaseDocuments({caseId,client,selected}:{caseId:string;client:SupabaseClient<Database>;selected?:DocumentPayload["kind"]}){
 const [records,source,latest]=await Promise.all([
 client.from("case_documents").select("id,kind,revision,created_at").eq("case_id",caseId).order("created_at",{ascending:false}),
 selected?client.rpc("get_case_document_source",{p_case:caseId,p_kind:selected}):Promise.resolve(null),
 selected?client.from("case_documents").select("id,snapshot").eq("case_id",caseId).eq("kind",selected).order("created_at",{ascending:false}).limit(1).maybeSingle():Promise.resolve(null)]);
 if(records.error)return <section id="ho-so-bieu-mau" className="panel my-5"><h2>Biên bản & phiếu lĩnh vật tư</h2><p role="alert">Chưa đọc được hồ sơ biểu mẫu. Hãy tải lại trang hoặc kiểm tra quyền truy cập.</p></section>;
 const parsed=source&&!source.error?sourceEnvelopeSchema.safeParse(source.data):null;
 const env=parsed?.success?parsed.data:undefined;
 const basis=selected==="material_requisition"?await requisitionBasis(client,caseId):undefined;
 const draft=env&&selected&&!latest?.error?(selected==="material_requisition"?prepareRequisition(env,latest?.data?.snapshot,basis):editorDocument(env,selected,latest?.data?.snapshot)):undefined;
 const defaults=env&&selected==="condition_minutes"?await minutesDefaults(client,env.workspace_id):undefined;
 return <section id="ho-so-bieu-mau" className="panel my-5 case-documents">
 <div className="section-heading"><div><p className="eyebrow">Hồ sơ theo mã vụ việc</p><h2>Biên bản & phiếu lĩnh vật tư</h2></div><span className="count-chip">{records.data?.length??0} phiên bản đã lưu</span></div>
 <p>Biên bản và phiếu lĩnh liên kết theo mã vụ việc. Phiếu mới kế thừa các dòng từ biên bản tình trạng đã lưu gần nhất; anh kiểm tra, sửa trước khi lưu.</p>
 <nav className="document-actions" aria-label="Chọn biểu mẫu vụ việc">{documentKinds.map(kind=><Link className={selected===kind?"button":"button button-secondary"} aria-current={selected===kind?"page":undefined} key={kind} href={`/cases/${caseId}?document=${kind}#ho-so-bieu-mau`}>{kind==="condition_minutes"?"Lập biên bản tình trạng":"Lập phiếu lĩnh vật tư"}</Link>)}</nav>
 {selected&&(!env||latest?.error)?<p role="alert">Chưa mở được biểu mẫu này. Kiểm tra quyền lập hồ sơ hoặc tải lại trang; chưa có dữ liệu nào được lưu.</p>:null}
 {draft&&env?<>
 {draft.sourceChanged?<p role="status">{selected==="condition_minutes"?"Vụ việc đã thay đổi. Ngày giờ và nội dung biên bản đã lưu vẫn được giữ riêng để anh chỉnh sửa.":"Nguồn vụ việc đã thay đổi. Kiểm tra lại các dòng vật tư trước khi lưu phiếu."}</p>:null}
 <DocumentEditor key={selected+(selected==="condition_minutes"?"":env.source_hash)+(latest?.data?.id??"")} caseId={caseId} sourceHash={env.source_hash} initial={draft.payload} defaults={defaults}/>
 </>:null}
 {records.data?.length?<details className="document-history"><summary>Các phiên bản đã lưu ({records.data.length})</summary><ul>{records.data.map(d=><li key={d.id}><Link href={`/cases/${caseId}/documents/${d.id}`}>{documentKindLabels[d.kind as DocumentPayload["kind"]]} · v{d.revision}</Link> · {new Date(d.created_at).toLocaleString("vi-VN",{timeZone:"Asia/Bangkok"})}</li>)}</ul></details>:<p className="muted mt-4">Chưa có biểu mẫu được lưu cho vụ việc này.</p>}
 <p className="muted mt-3">Lưu biểu mẫu không tự xác nhận xuất kho, thay/lắp hoặc trả phiếu. Bản đã lưu có thể xem, in và tải PDF.</p>
 </section>;
}
