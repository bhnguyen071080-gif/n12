"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {saveCaseDocument,saveDocumentToDrive} from "@/app/document-actions";
import {documentKindLabels,type DocumentPayload,type DocumentLine} from "@/lib/documents";
import {AsyncForm} from "./async-form";

type LineField="name"|"specification"|"catalogue_code"|"unit"|"limit_text"|"used_text"|"condition"|"notes";
const lineFields:readonly [LineField,string][]=[["name","Tên vật tư"],["specification","Nhãn hiệu / quy cách"],["catalogue_code","Danh điểm"],["unit","Đơn vị tính"],["limit_text","Định mức sử dụng"],["used_text","Thực hiện định mức (giờ đã dùng)"],["condition","Tình trạng kỹ thuật"],["notes","Ghi chú"]];
function LineEditor({line,update}:{line:DocumentLine;update:(line:DocumentLine)=>void}){
 return <div className="grid gap-3 md:grid-cols-2">{lineFields.map(([key,label])=><label key={key}>{label}<textarea rows={key==="condition"?3:1} value={line[key]} onChange={e=>update({...line,[key]:e.target.value})}/></label>)}
 <label>Số lượng xin lĩnh / đề nghị<input type="number" min="0.001" max="10000000" step="0.001" value={line.requested} onChange={e=>update({...line,requested:Number(e.target.value)})}/></label>
 <label>Số lượng thực phát (để trống nếu chưa xác nhận)<input type="number" min="0" max="10000000" step="0.001" value={line.issued??""} onChange={e=>update({...line,issued:e.target.value===""?null:Number(e.target.value)})}/></label>
 <label>Đơn giá VND (để trống nếu chưa biết)<input type="number" min="0" max="1000000000000" step="1" value={line.unit_price??""} onChange={e=>update({...line,unit_price:e.target.value===""?null:Number(e.target.value)})}/></label></div>;
}
export function DocumentEditor({caseId,sourceHash,initial}:{caseId:string;sourceHash:string;initial:DocumentPayload}){
 const [draft,setDraft]=useState(initial),[excluded,setExcluded]=useState<string[]>([]),router=useRouter();
 function set<K extends keyof DocumentPayload>(key:K,value:DocumentPayload[K]){setDraft(prev=>({...prev,[key]:value}));}
 const strings:readonly ["company"|"department"|"unit"|"location"|"equipment_label"|"form_code"|"document_number"|"warehouse",string][]=[
 ["company","Cơ quan / công ty"],["department","Phòng / bộ phận lập"],["unit","Đơn vị xin lĩnh"],["location","Địa điểm lập / kiểm tra"],
 ["equipment_label","Tên phương tiện trên bản in"],["form_code","Mã biểu mẫu"],["document_number","Số biên bản / phiếu (khác mã vụ việc)"],["warehouse","Lĩnh tại kho"]];
 return <section className="panel space-y-4"><h2>{documentKindLabels[draft.kind]} — chỉnh trước khi xuất</h2>
 <p>Không sao chép tên người, ngày, số phiếu hoặc kết luận của mẫu thành dữ liệu thật. Thông tin đơn vị lấy từ bản xuất gần nhất trong không gian này nếu có; hãy kiểm tra lại.</p>
 <AsyncForm action={saveCaseDocument} label="Lưu phiên bản & mở bản in" prepare={form=>form.set("payload",JSON.stringify({...draft,lines:draft.lines.filter(l=>!excluded.includes(l.usage_id))}))}
 onSuccess={r=>{if(r.id)router.push(`/cases/${caseId}/documents/${r.id}`);}}>
 <input type="hidden" name="case" value={caseId}/><input type="hidden" name="source_hash" value={sourceHash}/>
 <div className="grid gap-3 md:grid-cols-2">{strings.map(([key,label])=><label key={key}>{label}<input value={draft[key]} maxLength={key==="equipment_label"?300:200} required={["company","department","unit","location","equipment_label"].includes(key)} onChange={e=>set(key,e.target.value)}/></label>)}
 <label>Ngày giờ lập / kiểm tra<input type="datetime-local" required value={draft.document_at} onChange={e=>set("document_at",e.target.value)}/></label></div>
 <p>Ngày giờ này chỉ dùng cho biểu mẫu, không đổi thời điểm nhập mã vụ việc hoặc ngày thực hiện trong lý lịch.</p>
 {draft.kind==="condition_minutes"?<>
 <label>Đối tượng / nội dung kiểm tra<textarea rows={3} value={draft.inspection_subject} onChange={e=>set("inspection_subject",e.target.value)}/></label>
 <h3 className="font-bold">Thành phần tham gia và phần ký</h3>{draft.participants.map((p,i)=><div className="grid gap-3 md:grid-cols-2" key={i}>
 <label>Đơn vị đại diện {i+1}<input value={p.unit} maxLength={200} onChange={e=>set("participants",draft.participants.map((v,j)=>j===i?{...v,unit:e.target.value}:v))}/></label>
 <label>Người tham gia & chức danh {i+1}<textarea rows={2} placeholder="Mỗi người một dòng: Họ tên — Chức danh" value={p.members} onChange={e=>set("participants",draft.participants.map((v,j)=>j===i?{...v,members:e.target.value}:v))}/></label></div>)}
 <label>Nguyên nhân<textarea rows={3} value={draft.cause} onChange={e=>set("cause",e.target.value)}/></label>
 <label>Biện pháp khắc phục / đề xuất<textarea rows={4} value={draft.solution} onChange={e=>set("solution",e.target.value)}/></label>
 </>:<>
 <label>Lý do xuất kho<textarea rows={2} value={draft.reason} onChange={e=>set("reason",e.target.value)}/></label>
 <label>Tổng tiền bằng chữ (nếu đã có số thực phát và đơn giá)<textarea rows={2} value={draft.amount_words} onChange={e=>set("amount_words",e.target.value)}/></label>
 <div className="grid gap-3 sm:grid-cols-2">{["Phụ trách cung tiêu","Phòng TCKT","Thủ kho","Người nhận","Người lập"].map((label,i)=><label key={label}>{label} — họ tên (nếu có)<input value={draft.signer_names[i]} maxLength={100} onChange={e=>set("signer_names",draft.signer_names.map((v,j)=>j===i?e.target.value:v))}/></label>)}</div>
 </>}
 <h3 className="font-bold">Chọn các dòng vật tư của vụ việc</h3><p>Sửa số lượng tại đây chỉ sửa bản xuất. Không đổi số đã vay/lĩnh/thay trong dữ liệu theo dõi. Giờ thực hiện định mức chỉ điền khi đã đối chiếu kỳ tháng; không tự coi thiếu dữ liệu là 0.</p>
 {draft.lines.length===0?<p>Vụ việc chưa có vật tư. Có thể lập biên bản; muốn xuất phiếu lĩnh, hãy bổ sung dòng vật tư vào vụ việc trước.</p>:draft.lines.map((line,index)=>{
 const selected=!excluded.includes(line.usage_id);return <details className="border-t pt-3" key={line.usage_id} open={selected}>
 <summary className="cursor-pointer">Dòng {index+1}: {line.name}</summary>
 <label className="my-3"><input type="checkbox" checked={selected} onChange={e=>setExcluded(prev=>e.target.checked?prev.filter(id=>id!==line.usage_id):[...prev,line.usage_id])}/> Đưa dòng này vào bản xuất</label>
 {selected?<LineEditor line={line} update={value=>setDraft(prev=>({...prev,lines:prev.lines.map(l=>l.usage_id===value.usage_id?value:l)}))}/>:null}</details>;
 })}
 <label><input name="reviewed" type="checkbox" required/> Tôi đã kiểm tra ngày giờ, phương tiện, tên người tham gia, số lượng và nội dung trước khi xuất.</label>
 <p>Biên bản: A4. Phiếu lĩnh: 2 bản A5 giống nhau trên A4; nhiều vật tư sẽ chia thêm tờ, không cắt mất dòng. Không tạo chữ ký hoặc tự đánh dấu nghiệm thu/trả phiếu.</p>
 </AsyncForm></section>;
}
export function DriveArchiveButton({documentId,configured}:{documentId:string;configured:boolean}){
 return configured?<AsyncForm action={saveDocumentToDrive} label="Lưu PDF lên Google Drive"><input type="hidden" name="document" value={documentId}/></AsyncForm>:
 <p>Kết nối Drive của ứng dụng chưa được cấu hình. Phiên bản dữ liệu đã lưu trên cloud, nhưng PDF chưa được lưu lên Drive.</p>;
}
