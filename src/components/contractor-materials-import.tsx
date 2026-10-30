"use client";
import {useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {AsyncForm} from "./async-form";
import {parseCsv} from "@/lib/csv";
import {normalizeLookup,parseContractorImportGrid,type ContractorImportIssue,type ContractorImportRow} from "@/lib/contractor-materials";
import {importContractorMaterials} from "@/app/contractor-materials/actions";

type Equipment={id:string;code:string;name:string};
export function ContractorMaterialsImport({workspace,equipment}:{workspace:string;equipment:Equipment[]}){
 const router=useRouter(),input=useRef<HTMLInputElement>(null),[rows,setRows]=useState<ContractorImportRow[]>([]),[issues,setIssues]=useState<ContractorImportIssue[]>([]),[filename,setFilename]=useState(""),[message,setMessage]=useState("");
 const known=new Set(equipment.flatMap(item=>[normalizeLookup(item.name),normalizeLookup(item.code)])),unmatched=rows.filter(row=>!known.has(normalizeLookup(row.equipment_name))&&!known.has(normalizeLookup(row.equipment_code)));
 async function choose(file?:File){setRows([]);setIssues([]);setMessage("");if(!file)return;setFilename(file.name);
  try{let grid:(string|number|null)[][];if(/\.xlsx$/i.test(file.name)){if(file.size>1048576)throw new Error("Tệp Excel tối đa 1 MiB; hãy tách dữ liệu nếu cần.");const {extractImportXml,parseImportXml}=await import("@/lib/xlsx-import");grid=parseImportXml(extractImportXml(new Uint8Array(await file.arrayBuffer())),"VT_DVSC");}
   else if(/\.csv$/i.test(file.name)){if(file.size>262144)throw new Error("CSV tối đa 256 KiB.");const text=await file.text();grid=parseCsv(text,text.split(/\r?\n/)[0].includes(";")?";":",");}else throw new Error("Chọn tệp .xlsx có trang VT_DVSC hoặc tệp .csv.");
   const parsed=parseContractorImportGrid(grid);setRows(parsed.rows);setIssues(parsed.issues);
  }catch(error){setMessage(error instanceof Error?error.message:"Không đọc được tệp.");}
 }
 return <section className="panel"><details><summary className="contractor-form-summary">Đồng bộ dữ liệu cũ từ mẫu VT_DVSC</summary><div className="contractor-form-body space-y-4"><p className="muted">Nhận tệp Excel có trang <strong>VT_DVSC</strong> hoặc CSV cùng cấu trúc. Cột Dự kiến/Hết hạn chỉ dùng đối chiếu; hệ thống tự tính lại bảo hành.</p>
  <button type="button" className="button button-secondary" onClick={()=>input.current?.click()}>Chọn tệp để xem trước</button><input ref={input} hidden type="file" accept=".xlsx,.csv" onChange={event=>{const file=event.target.files?.[0];event.target.value="";void choose(file);}}/>
  {filename&&<p className="muted">{filename}</p>}{message&&<p role="alert">{message}</p>}
  {issues.length>0&&<div className="overflow-x-auto"><table><thead><tr><th>Dòng</th><th>Cột</th><th>Cần sửa</th></tr></thead><tbody>{issues.slice(0,100).map((issue,index)=><tr key={index}><td>{issue.line}</td><td>{issue.column}</td><td>{issue.message}</td></tr>)}</tbody></table></div>}
  {rows.length>0&&issues.length===0&&<><p className={unmatched.length?"plan-warning":"plan-ok"}>Đã đọc {rows.length} dòng. {unmatched.length?`${unmatched.length} dòng chưa khớp phương tiện; chưa thể nhập.`:"Tất cả phương tiện đã khớp theo tên hoặc mã gõ tắt."}</p>
   <div className="overflow-x-auto"><table className="compact-table"><thead><tr><th>Dòng</th><th>Vật tư</th><th>Phương tiện</th><th>Ngày ký</th><th>BH</th></tr></thead><tbody>{rows.slice(0,10).map(row=><tr key={row.line}><td>{row.line}</td><td>{row.material_name} · {row.quantity} {row.unit}</td><td>{row.equipment_name} <small>{row.equipment_code}</small></td><td>{row.signed_on}</td><td>{row.warranty_months} tháng</td></tr>)}</tbody></table></div>
   {rows.length>10&&<p className="muted">Đang hiển thị 10/{rows.length} dòng để đối chiếu nhanh.</p>}
   {!unmatched.length&&<AsyncForm action={importContractorMaterials} label="Xác nhận nhập dữ liệu cũ" onSuccess={()=>{setRows([]);setFilename("");router.refresh();}}><input type="hidden" name="workspace" value={workspace}/><input type="hidden" name="rows" value={JSON.stringify(rows)}/><label><input type="checkbox" name="confirmed" required/> Tôi đã kiểm tra bản xem trước và đúng nguồn VT_DVSC.</label></AsyncForm>}</>}
 </div></details></section>;
}

