"use client";
import {useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {saveCaseDocument,saveDocumentToDrive} from "@/app/document-actions";
import {documentKindLabels,inspectionLine,issuedAmount,knownTotal,type DocumentPayload,type DocumentLine} from "@/lib/documents";
import {AsyncForm} from "./async-form";
import {RepresentativeEditor} from "./representative-editor";
import {parseRepresentatives,serializeRepresentatives} from "../lib/document-people";
import type {MinutesDefaults} from "../lib/document-defaults";

type LineField="name"|"specification"|"catalogue_code"|"unit"|"limit_text"|"used_text"|"condition"|"notes";
const lineFields:readonly [LineField,string][]=[["name","Tên vật tư"],["specification","Nhãn hiệu / quy cách"],["catalogue_code","Danh điểm"],["unit","Đơn vị tính"],["limit_text","Định mức sử dụng"],["used_text","Thực hiện định mức (giờ đã dùng)"],["condition","Tình trạng kỹ thuật"],["notes","Ghi chú"]];
function LineEditor({line,kind,update}:{line:DocumentLine;kind:DocumentPayload["kind"];update:(line:DocumentLine)=>void}){
 const minutes=kind==="condition_minutes";
 const fields=lineFields.filter(([key])=>minutes?key!=="catalogue_code":!["limit_text","used_text","condition","notes"].includes(key));
 return <div className="grid gap-3 md:grid-cols-2">{fields.map(([key,label])=><label key={key}>{key==="name"&&minutes?"Tên phương tiện thiết bị / vật tư":key==="limit_text"?"Định mức":key==="used_text"?"Thực hiện":label}<textarea rows={key==="condition"?3:1} required={key==="name"||key==="unit"} maxLength={key==="condition"?4000:key==="notes"?1000:key==="unit"?40:key==="catalogue_code"?100:key==="limit_text"||key==="used_text"?200:500} placeholder={key==="limit_text"||key==="used_text"?"Nhập giá trị và đơn vị; chưa rõ thì để trống":undefined} value={line[key]} onChange={e=>update({...line,[key]:e.target.value})}/></label>)}
 <label>{minutes?"Số lượng kiểm tra":"Số lượng xin lĩnh / đề nghị"}<input type="number" required min="0.001" max="10000000" step="0.001" value={line.requested||""} onChange={e=>update({...line,requested:Number(e.target.value)})}/></label>
 {!minutes?<>
 <label>Số lượng thực phát (để trống nếu chưa xác nhận)<input type="number" min="0" max="10000000" step="0.001" value={line.issued??""} onChange={e=>update({...line,issued:e.target.value===""?null:Number(e.target.value)})}/></label>
 <label>Đơn giá VND (để trống nếu chưa biết)<input type="number" min="0" max="1000000000000" step="1" value={line.unit_price??""} onChange={e=>update({...line,unit_price:e.target.value===""?null:Number(e.target.value)})}/></label><label>Thành tiền (tự tính)<output>{issuedAmount(line)?.toLocaleString("vi-VN")??"Chưa có số thực phát / đơn giá"}</output></label></>:null}</div>;
}
type InspectionRow={key:string;value:DocumentLine};
function InspectionTable({rows,update,remove}:{rows:InspectionRow[];update:(key:string,value:DocumentLine)=>void;remove:(key:string)=>void}){
 return <div className="inspection-table-scroll" role="region" aria-label="Bảng nhập tình trạng kỹ thuật" tabIndex={0}><table className="inspection-table">
 <caption>Bảng kiểm tra theo BM.12.06 — mỗi thiết bị, bộ phận hoặc vật tư một dòng</caption>
 <thead><tr><th rowSpan={2} scope="col">STT</th><th rowSpan={2} scope="col">Tên phương tiện thiết bị, vật tư</th><th rowSpan={2} scope="col">Đơn vị tính</th><th rowSpan={2} scope="col">Số lượng</th><th colSpan={2} scope="colgroup">Định mức sử dụng</th><th rowSpan={2} scope="col">Tình trạng kỹ thuật</th><th rowSpan={2} scope="col">Ghi chú</th></tr><tr><th scope="col">Định mức</th><th scope="col">Thực hiện</th></tr></thead>
 <tbody>{rows.map(({key,value:line},index)=>{
 const text=(field:LineField,label:string,max:number,required=false)=><textarea aria-label={`${label} dòng ${index+1}`} rows={3} maxLength={max} required={required} value={line[field]} onChange={e=>update(key,{...line,[field]:e.target.value})}/>;
 return <tr key={key}><th scope="row"><span>{index+1}</span><button type="button" className="button-secondary" aria-label={`Bỏ dòng kiểm tra ${index+1}`} onClick={()=>remove(key)}>Bỏ</button></th>
 <td>{text("name","Tên phương tiện thiết bị, vật tư",500,true)}<input aria-label={`Quy cách dòng ${index+1}`} placeholder="Quy cách / nhãn hiệu (nếu có)" maxLength={500} value={line.specification} onChange={e=>update(key,{...line,specification:e.target.value})}/></td>
 <td>{text("unit","Đơn vị tính",40,true)}</td><td><input aria-label={`Số lượng dòng ${index+1}`} type="number" required min="0.001" max="10000000" step="0.001" value={line.requested||""} onChange={e=>update(key,{...line,requested:Number(e.target.value)})}/></td>
 <td>{text("limit_text","Định mức",200)}</td><td>{text("used_text","Thực hiện",200)}</td><td>{text("condition","Tình trạng kỹ thuật",4000)}</td><td>{text("notes","Ghi chú",1000)}</td></tr>;
 })}</tbody></table></div>;
}
export function DocumentEditor({caseId,sourceHash,initial,defaults}:{caseId:string;sourceHash:string;initial:DocumentPayload;defaults?:MinutesDefaults}){
 const [draft,setDraft]=useState(initial),[excluded,setExcluded]=useState<string[]>([]),router=useRouter();
 const [rows,setRows]=useState(()=>initial.lines.map((value,i)=>({key:`saved-${i}`,value}))),nextRow=useRef(0);
 const [peopleVersion,setPeopleVersion]=useState(0);
 function set<K extends keyof DocumentPayload>(key:K,value:DocumentPayload[K]){setDraft(prev=>({...prev,[key]:value}));}
 const strings:readonly ["company"|"department"|"unit"|"location"|"equipment_label"|"form_code"|"document_number"|"warehouse",string][]=[
 ["company","Cơ quan / công ty"],["department","Phòng / bộ phận lập"],["unit","Đơn vị xin lĩnh"],["location","Địa điểm lập / kiểm tra"],
 ["equipment_label","Tên phương tiện trên bản in"],["form_code","Mã biểu mẫu"],["document_number","Số biên bản / phiếu (khác mã vụ việc)"],["warehouse","Lĩnh tại kho"]];
 const minutes=draft.kind==="condition_minutes";
 function updateRow(key:string,value:DocumentLine){setRows(prev=>prev.map(row=>row.key===key?{...row,value}:row));}
 return <section className="panel space-y-4 document-editor"><h2>{documentKindLabels[draft.kind]}</h2>
 <p>{minutes?"Biên bản nhập độc lập theo mẫu BM.12.06. Mã vụ việc chỉ để liên kết hồ sơ; ngày giờ kiểm tra, thành phần, bảng kiểm tra và kết luận do anh nhập, điều chỉnh tại đây.":"Phiếu lĩnh theo mẫu BM.08.06: chỉ nhập thông tin trên mẫu. Kiểm tra và điều chỉnh các dòng xin lĩnh trước khi lưu; không tự xác nhận xuất kho."}</p>
 {!minutes&&draft.basis_document_id?<p role="status">Đã kế thừa nội dung từ <a href={`/cases/${caseId}/documents/${draft.basis_document_id}`} target="_blank" rel="noopener noreferrer">biên bản tình trạng cùng mã vụ việc</a>. Số lượng là gợi ý xin lĩnh; số thực phát, đơn giá và người nhận vẫn để trống nếu chưa xác nhận.</p>:null}
 {draft.kind==="condition_minutes"?<p><a href="#bang-kiem-tra">Đến bảng kiểm tra · Định mức / Thực hiện ↓</a></p>:null}
 <AsyncForm action={saveCaseDocument} label={draft.kind==="condition_minutes"?"Lưu biên bản & mở bản in":"Lưu phiếu lĩnh & mở bản in"} prepare={form=>form.set("payload",JSON.stringify({...draft,participants:minutes?draft.participants.map(p=>({...p,members:serializeRepresentatives(parseRepresentatives(p.members))})):draft.participants,lines:rows.filter(row=>!excluded.includes(row.key)).map(row=>row.value)}))}
 onSuccess={r=>{if(r.id)router.push(`/cases/${caseId}/documents/${r.id}`);}}>
 <input type="hidden" name="case" value={caseId}/><input type="hidden" name="source_hash" value={sourceHash}/>
 <h3 className="document-section-title">1. Thông tin biểu mẫu</h3>
 <div className="grid gap-3 md:grid-cols-2">{strings.filter(([key])=>minutes?key!=="warehouse":["company","department","document_number","warehouse"].includes(key)).map(([key,label])=><label key={key}>{key==="unit"&&minutes?"Đơn vị lập biên bản":key==="equipment_label"&&minutes?"Phương tiện thiết bị / công cụ xếp dỡ":key==="document_number"&&!minutes?"Số phiếu":label}<input value={draft[key]} maxLength={key==="equipment_label"?300:key==="form_code"?50:key==="document_number"?100:200} required={["company","department","unit","location","equipment_label"].includes(key)} onChange={e=>set(key,e.target.value)}/></label>)}
 {minutes?<label>Ngày giờ lập / kiểm tra<input type="datetime-local" required value={draft.document_at} onChange={e=>set("document_at",e.target.value)}/></label>:<><label>Ngày lập phiếu<input type="datetime-local" required value={draft.document_at} onChange={e=>set("document_at",e.target.value)}/></label><label>Họ và tên người nhận hàng<input maxLength={100} value={draft.signer_names[2]} onChange={e=>set("signer_names",draft.signer_names.map((v,i)=>i===2?e.target.value:v))}/></label></>}</div>
 <p>{minutes?"Ngày giờ này chỉ dùng cho biểu mẫu, không đổi thời điểm nhập mã vụ việc hoặc ngày thực hiện trong lý lịch.":"Số phiếu và ngày lập được in theo mẫu BM.08.06; không thay đổi mã vụ việc hoặc ngày thực hiện kỹ thuật."}</p>
 {draft.kind==="condition_minutes"?<>
 <label>Đối tượng / nội dung kiểm tra<textarea rows={3} maxLength={1500} value={draft.inspection_subject} onChange={e=>set("inspection_subject",e.target.value)}/></label>
 <h3 className="document-section-title">2. Thành phần tham gia và phần ký</h3>
 {defaults?<details className="reuse-minutes"><summary>Dùng lại thông tin đã lưu trong cùng khu vực dữ liệu</summary><p>Chỉ dùng lại cơ quan, phòng, đơn vị và thành phần tham gia; không chép ngày giờ, phương tiện, địa điểm, nguyên nhân hoặc kết luận.</p><p>{defaults.participants.map(p=>`${p.unit}: ${parseRepresentatives(p.members).map(person=>person.name).join(", ")}`).join(" · ")}</p><button type="button" className="button-secondary" onClick={()=>{setDraft(prev=>({...prev,...defaults}));setPeopleVersion(v=>v+1);}}>Dùng lại thành phần và thông tin đơn vị</button></details>:null}
 <RepresentativeEditor key={peopleVersion} initial={draft.participants} onChange={participants=>set("participants",participants)}/>
 </>:<>
 <label>Lý do xuất kho<textarea rows={2} value={draft.reason} onChange={e=>set("reason",e.target.value)}/></label>
 <label>Tổng tiền bằng chữ (nếu đã có số thực phát và đơn giá)<textarea rows={2} value={draft.amount_words} onChange={e=>set("amount_words",e.target.value)}/></label>
 <h3 className="document-section-title">2. Người ký trên phiếu</h3>
 <div className="grid gap-3 sm:grid-cols-2">{["Phòng TCKT","Thủ kho","Người nhận","Lãnh đạo Phòng"].map((label,i)=>i===2?<p key={label}>Người nhận: {draft.signer_names[2]||"Chưa nhập ở phần thông tin phiếu"}</p>:<label key={label}>{label} — họ tên (nếu có)<input value={draft.signer_names[i]} maxLength={100} onChange={e=>set("signer_names",draft.signer_names.map((v,j)=>j===i?e.target.value:v))}/></label>)}</div>
 </>}
 <h3 id="bang-kiem-tra" className="document-section-title scroll-mt-5">{minutes?"3. Bảng kiểm tra tình trạng · Định mức / Thực hiện":"3. Vật tư xin lĩnh"}</h3>
 <p>{draft.kind==="condition_minutes"?"Nhập định mức và giá trị thực hiện tương ứng cho từng thiết bị/vật tư. Ghi kèm đơn vị; chưa rõ thì để trống, không tự coi là 0. Dòng thêm tại đây chỉ thuộc biên bản, không tạo giao dịch vật tư.":"Sửa số lượng tại đây chỉ sửa bản xuất. Không đổi số đã vay/lĩnh/thay trong dữ liệu theo dõi."}</p>
 {minutes?<InspectionTable rows={rows} update={updateRow} remove={key=>setRows(prev=>prev.filter(row=>row.key!==key))}/>:rows.length===0?<p>Chưa có dòng xin lĩnh. Lưu biên bản tình trạng có các dòng vật tư để kế thừa, hoặc thêm vật tư vào hạng mục của vụ việc.</p>:rows.map((row,index)=>{
 const line=row.value,selected=!excluded.includes(row.key);return <details className="border-t py-4" key={row.key} open={selected}>
 <summary className="cursor-pointer font-bold">Dòng {index+1}: {line.name||"Thiết bị / vật tư cần kiểm tra"}</summary>
 <label className="my-3"><input type="checkbox" checked={selected} onChange={e=>setExcluded(prev=>e.target.checked?prev.filter(id=>id!==row.key):[...prev,row.key])}/> Đưa dòng này vào bản xuất</label>
 {selected?<LineEditor line={line} kind={draft.kind} update={value=>setRows(prev=>prev.map(r=>r.key===row.key?{...r,value}:r))}/>:null}
 {line.usage_id===null?<button type="button" className="button-secondary mt-3" onClick={()=>setRows(prev=>prev.filter(r=>r.key!==row.key))}>Bỏ dòng vật tư {index+1}</button>:null}</details>;
 })}
 {draft.kind==="condition_minutes"?<button type="button" className="button-secondary" disabled={rows.length>=150} onClick={()=>{const key=`new-${nextRow.current++}`;setRows(prev=>[...prev,{key,value:inspectionLine()}]);}}>Thêm dòng kiểm tra</button>:null}
 {!minutes&&draft.basis_document_id?<button type="button" className="button-secondary" disabled={rows.length>=150} onClick={()=>{const key=`new-${nextRow.current++}`;setRows(prev=>[...prev,{key,value:inspectionLine()}]);}}>Thêm dòng xin lĩnh</button>:null}
 {!minutes?<p>Cộng thành tiền: {knownTotal(rows.filter(row=>!excluded.includes(row.key)).map(row=>row.value))?.toLocaleString("vi-VN")??"Chưa đủ số thực phát và đơn giá"}</p>:null}
 {minutes?<><h3 className="document-section-title">4. Kết luận</h3>
 <label>Nguyên nhân<textarea rows={3} maxLength={8000} value={draft.cause} onChange={e=>set("cause",e.target.value)}/></label>
 <label>Đề xuất biện pháp khắc phục<textarea rows={4} maxLength={8000} value={draft.solution} onChange={e=>set("solution",e.target.value)}/></label>
 <p>Lưu tạo một phiên bản biên bản. Anh có thể mở lại để điều chỉnh và lưu phiên bản tiếp theo; bản cũ vẫn được giữ. Không lấy ngày tạo mã vụ việc làm ngày kiểm tra.</p></>:null}
 <label><input name="reviewed" type="checkbox" required/> Tôi đã kiểm tra ngày giờ, phương tiện, tên người tham gia, số lượng và nội dung trước khi xuất.</label>
 <p>Biên bản: A4. Phiếu lĩnh: 2 bản A5 giống nhau trên A4; nhiều vật tư sẽ chia thêm tờ, không cắt mất dòng. Không tạo chữ ký hoặc tự đánh dấu nghiệm thu/trả phiếu.</p>
 </AsyncForm></section>;
}
export function DriveArchiveButton({documentId,configured}:{documentId:string;configured:boolean}){
 return configured?<AsyncForm action={saveDocumentToDrive} label="Lưu PDF lên Google Drive"><input type="hidden" name="document" value={documentId}/></AsyncForm>:
 <p>Kết nối Drive của ứng dụng chưa được cấu hình. Phiên bản dữ liệu đã lưu trên cloud, nhưng PDF chưa được lưu lên Drive.</p>;
}
