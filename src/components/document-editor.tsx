"use client";
import {useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {saveCaseDocument,saveDocumentToDrive} from "@/app/document-actions";
import {documentKindLabels,inspectionLine,type DocumentPayload,type DocumentLine} from "@/lib/documents";
import {AsyncForm} from "./async-form";

type LineField="name"|"specification"|"catalogue_code"|"unit"|"limit_text"|"used_text"|"condition"|"notes";
const lineFields:readonly [LineField,string][]=[["name","Tên vật tư"],["specification","Nhãn hiệu / quy cách"],["catalogue_code","Danh điểm"],["unit","Đơn vị tính"],["limit_text","Định mức sử dụng"],["used_text","Thực hiện định mức (giờ đã dùng)"],["condition","Tình trạng kỹ thuật"],["notes","Ghi chú"]];
function LineEditor({line,kind,update}:{line:DocumentLine;kind:DocumentPayload["kind"];update:(line:DocumentLine)=>void}){
 const minutes=kind==="condition_minutes";
 const fields=lineFields.filter(([key])=>minutes?key!=="catalogue_code":!["limit_text","used_text","condition","notes"].includes(key));
 return <div className="grid gap-3 md:grid-cols-2">{fields.map(([key,label])=><label key={key}>{key==="name"&&minutes?"Tên phương tiện thiết bị / vật tư":key==="limit_text"?"Định mức":key==="used_text"?"Thực hiện":label}<textarea rows={key==="condition"?3:1} required={key==="name"||key==="unit"} maxLength={key==="condition"?4000:key==="notes"?1000:key==="unit"?40:key==="catalogue_code"?100:key==="limit_text"||key==="used_text"?200:500} placeholder={key==="limit_text"||key==="used_text"?"Nhập giá trị và đơn vị; chưa rõ thì để trống":undefined} value={line[key]} onChange={e=>update({...line,[key]:e.target.value})}/></label>)}
 <label>{minutes?"Số lượng kiểm tra":"Số lượng xin lĩnh / đề nghị"}<input type="number" required min="0.001" max="10000000" step="0.001" value={line.requested||""} onChange={e=>update({...line,requested:Number(e.target.value)})}/></label>
 {!minutes?<>
 <label>Số lượng thực phát (để trống nếu chưa xác nhận)<input type="number" min="0" max="10000000" step="0.001" value={line.issued??""} onChange={e=>update({...line,issued:e.target.value===""?null:Number(e.target.value)})}/></label>
 <label>Đơn giá VND (để trống nếu chưa biết)<input type="number" min="0" max="1000000000000" step="1" value={line.unit_price??""} onChange={e=>update({...line,unit_price:e.target.value===""?null:Number(e.target.value)})}/></label></>:null}</div>;
}
export function DocumentEditor({caseId,sourceHash,initial}:{caseId:string;sourceHash:string;initial:DocumentPayload}){
 const [draft,setDraft]=useState(initial),[excluded,setExcluded]=useState<string[]>([]),router=useRouter();
 const [rows,setRows]=useState(()=>initial.lines.map((value,i)=>({key:`saved-${i}`,value}))),nextRow=useRef(0);
 function set<K extends keyof DocumentPayload>(key:K,value:DocumentPayload[K]){setDraft(prev=>({...prev,[key]:value}));}
 const strings:readonly ["company"|"department"|"unit"|"location"|"equipment_label"|"form_code"|"document_number"|"warehouse",string][]=[
 ["company","Cơ quan / công ty"],["department","Phòng / bộ phận lập"],["unit","Đơn vị xin lĩnh"],["location","Địa điểm lập / kiểm tra"],
 ["equipment_label","Tên phương tiện trên bản in"],["form_code","Mã biểu mẫu"],["document_number","Số biên bản / phiếu (khác mã vụ việc)"],["warehouse","Lĩnh tại kho"]];
 return <section className="panel space-y-4"><h2>{documentKindLabels[draft.kind]} — chỉnh trước khi xuất</h2>
 <p>Thông tin lấy từ vụ việc và phiên bản đã lưu của chính vụ việc này. Kiểm tra lại nội dung trước khi lưu hoặc in.</p>
 {draft.kind==="condition_minutes"?<p><a href="#bang-kiem-tra">Đến bảng kiểm tra · Định mức / Thực hiện ↓</a></p>:null}
 <AsyncForm action={saveCaseDocument} label={draft.kind==="condition_minutes"?"Lưu biên bản & mở bản in":"Lưu phiếu lĩnh & mở bản in"} prepare={form=>form.set("payload",JSON.stringify({...draft,lines:rows.filter(row=>!excluded.includes(row.key)).map(row=>row.value)}))}
 onSuccess={r=>{if(r.id)router.push(`/cases/${caseId}/documents/${r.id}`);}}>
 <input type="hidden" name="case" value={caseId}/><input type="hidden" name="source_hash" value={sourceHash}/>
 <div className="grid gap-3 md:grid-cols-2">{strings.filter(([key])=>draft.kind!=="condition_minutes"||key!=="warehouse").map(([key,label])=><label key={key}>{key==="unit"&&draft.kind==="condition_minutes"?"Đơn vị lập biên bản":label}<input value={draft[key]} maxLength={key==="equipment_label"?300:key==="form_code"?50:key==="document_number"?100:200} required={["company","department","unit","location","equipment_label"].includes(key)} onChange={e=>set(key,e.target.value)}/></label>)}
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
 <h3 id="bang-kiem-tra" className="font-bold scroll-mt-5">{draft.kind==="condition_minutes"?"Bảng kiểm tra tình trạng · Định mức / Thực hiện":"Chọn các dòng vật tư của vụ việc"}</h3>
 <p>{draft.kind==="condition_minutes"?"Nhập định mức và giá trị thực hiện tương ứng cho từng thiết bị/vật tư. Ghi kèm đơn vị; chưa rõ thì để trống, không tự coi là 0. Dòng thêm tại đây chỉ thuộc biên bản, không tạo giao dịch vật tư.":"Sửa số lượng tại đây chỉ sửa bản xuất. Không đổi số đã vay/lĩnh/thay trong dữ liệu theo dõi."}</p>
 {rows.length===0?<p>{draft.kind==="condition_minutes"?"Bấm Thêm dòng kiểm tra để nhập thiết bị/vật tư, định mức và thực hiện.":"Vụ việc chưa có vật tư. Hãy bổ sung dòng vật tư vào vụ việc trước khi lập phiếu lĩnh."}</p>:rows.map((row,index)=>{
 const line=row.value,selected=!excluded.includes(row.key);return <details className="border-t py-4" key={row.key} open={selected}>
 <summary className="cursor-pointer font-bold">Dòng {index+1}: {line.name||"Thiết bị / vật tư cần kiểm tra"}</summary>
 <label className="my-3"><input type="checkbox" checked={selected} onChange={e=>setExcluded(prev=>e.target.checked?prev.filter(id=>id!==row.key):[...prev,row.key])}/> Đưa dòng này vào bản xuất</label>
 {selected?<LineEditor line={line} kind={draft.kind} update={value=>setRows(prev=>prev.map(r=>r.key===row.key?{...r,value}:r))}/>:null}
 {line.usage_id===null?<button type="button" className="button-secondary mt-3" onClick={()=>setRows(prev=>prev.filter(r=>r.key!==row.key))}>Bỏ dòng kiểm tra {index+1}</button>:null}</details>;
 })}
 {draft.kind==="condition_minutes"?<button type="button" className="button-secondary" disabled={rows.length>=150} onClick={()=>{const key=`new-${nextRow.current++}`;setRows(prev=>[...prev,{key,value:inspectionLine()}]);}}>Thêm dòng kiểm tra</button>:null}
 <label><input name="reviewed" type="checkbox" required/> Tôi đã kiểm tra ngày giờ, phương tiện, tên người tham gia, số lượng và nội dung trước khi xuất.</label>
 <p>Biên bản: A4. Phiếu lĩnh: 2 bản A5 giống nhau trên A4; nhiều vật tư sẽ chia thêm tờ, không cắt mất dòng. Không tạo chữ ký hoặc tự đánh dấu nghiệm thu/trả phiếu.</p>
 </AsyncForm></section>;
}
export function DriveArchiveButton({documentId,configured}:{documentId:string;configured:boolean}){
 return configured?<AsyncForm action={saveDocumentToDrive} label="Lưu PDF lên Google Drive"><input type="hidden" name="document" value={documentId}/></AsyncForm>:
 <p>Kết nối Drive của ứng dụng chưa được cấu hình. Phiên bản dữ liệu đã lưu trên cloud, nhưng PDF chưa được lưu lên Drive.</p>;
}
