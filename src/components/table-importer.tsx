"use client";
import {useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {importSpecs,parseImportGrid,type ImportKind,type ImportIssue} from "@/lib/table-import";
import {parseCsv} from "@/lib/csv";
import {newRowsOnly} from "@/lib/simple-import";
import {createRequestKey} from "@/lib/request-key";
import {previewTable,commitTable} from "@/app/imports/actions";
type Request={fingerprint:string;key:string;plan:string;unchanged:number};
export function TableImporter({workspace,kind,canImport,embedded=false}:{workspace:string;kind:ImportKind;canImport:boolean;embedded?:boolean}){
 const router=useRouter(),fileInput=useRef<HTMLInputElement>(null),running=useRef(false),request=useRef<Request|undefined>(undefined);
 const [busy,setBusy]=useState(false),[filename,setFilename]=useState(""),[message,setMessage]=useState(""),[issues,setIssues]=useState<ImportIssue[]>([]),[ok,setOk]=useState(false);
 async function choose(file:File|undefined){
  if(!file||running.current)return;running.current=true;setBusy(true);setFilename(file.name);setMessage("");setIssues([]);setOk(false);
  let phase:"read"|"check"|"write"="read";
  try{
   let grid:(string|number|null)[][];
   if(/\.xlsx$/i.test(file.name)){if(file.size>1048576)throw Error("Tệp Excel tối đa 1 MiB.");const {readImportXlsx}=await import("@/lib/xlsx-import");grid=readImportXlsx(new Uint8Array(await file.arrayBuffer()),kind);}
   else if(/\.csv$/i.test(file.name)){if(file.size>262144)throw Error("Tệp CSV tối đa 256 KiB.");const text=await file.text();grid=parseCsv(text,text.split(/\r?\n/)[0].includes(";")?";":",");}
   else throw Error("Chọn tệp Excel .xlsx. Tệp .xls cần lưu lại thành .xlsx.");
   const parsed=parseImportGrid(grid,kind);
   if(parsed.issues.length){setIssues(parsed.issues);setMessage(parsed.issues[0].message==="Tệp chưa có dòng dữ liệu."?"Mẫu đang trống. Điền dữ liệu vào trang "+importSpecs[kind].sheet+", lưu tệp rồi bấm Nhập dữ liệu để chọn lại.":"Tệp có lỗi. Sửa các dòng bên dưới rồi bấm Nhập dữ liệu để chọn lại. Chưa lưu dòng nào.");return;}
   phase="check";const fingerprint=JSON.stringify([workspace,kind,parsed.rows]);
   if(request.current?.fingerprint!==fingerprint){
    const data=new FormData();data.set("workspace",workspace);data.set("kind",kind);data.set("rows",JSON.stringify(parsed.rows));
    const checked=await previewTable(data);
    if(!checked.ok||!checked.plan){setMessage(checked.message);return;}
    const prepared=newRowsOnly(checked.plan);
    if(!prepared.rows.length){setOk(true);setMessage("Dữ liệu đã có đầy đủ ("+prepared.unchanged+" dòng). Không nhập trùng.");return;}
    request.current={fingerprint,key:createRequestKey(),plan:JSON.stringify(prepared.rows),unchanged:prepared.unchanged};
   }
   const current=request.current,data=new FormData();data.set("workspace",workspace);data.set("kind",kind);data.set("mode","add");data.set("request_key",current.key);data.set("plan",current.plan);
   phase="write";const saved=await commitTable(data);setOk(saved.ok);setMessage(saved.ok?"Đã nhập "+JSON.parse(current.plan).length+" dòng."+(current.unchanged?" Giữ nguyên "+current.unchanged+" dòng đã có.":""):saved.message);
   if(saved.ok)router.refresh();
  }catch(error){setMessage(phase!=="write"&&error instanceof Error?error.message.slice(0,300)+" Chưa lưu dữ liệu.":"Chưa nhận được xác nhận nhập. Bấm Nhập dữ liệu và chọn lại đúng tệp để thử lại an toàn.");}
  finally{running.current=false;setBusy(false);}
 }
 return <section className={embedded?"simple-import":"panel simple-import"} aria-label={"Nhập Excel · "+importSpecs[kind].title}>
  <div className="simple-import-actions"><a className="button button-secondary" href="/api/import-template">Tải mẫu Excel</a><button type="button" disabled={busy||!canImport} onClick={()=>fileInput.current?.click()}>{busy?"Đang nhập dữ liệu…":"Nhập dữ liệu"}</button><input ref={fileInput} hidden type="file" aria-label="Tệp nhập dữ liệu" accept=".xlsx,.csv" onChange={e=>{const file=e.target.files?.[0];e.target.value="";void choose(file);}}/></div>
  <p className="muted">Điền trang <strong>{importSpecs[kind].sheet}</strong> trong mẫu, lưu tệp rồi bấm Nhập dữ liệu.</p>
  {!canImport&&<p>Bạn chưa có quyền nhập dữ liệu trong khu vực này.</p>}
  {filename&&<p className="muted">{filename}</p>}
  {message&&<p role={ok?"status":"alert"} aria-live="polite">{message}</p>}
  {issues.length>0&&<div className="overflow-x-auto"><table><thead><tr><th>Dòng</th><th>Cột</th><th>Cần sửa</th></tr></thead><tbody>{issues.slice(0,100).map((issue,i)=><tr key={i}><td>{issue.line}</td><td>{issue.column}</td><td>{issue.message}</td></tr>)}</tbody></table></div>}
 </section>;
}
