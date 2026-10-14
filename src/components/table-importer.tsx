"use client";
import {useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {importSpecs,parseImportGrid,rowCells,type ImportKind,type ImportRow,type ImportIssue,type ImportPlan} from "@/lib/table-import";
import {parseCsv,csvOutput} from "@/lib/csv";
import {previewTable,commitTable} from "@/app/imports/actions";
import {AsyncForm} from "./async-form";
export function TableImporter({workspace,kind,canImport}:{workspace:string;kind:ImportKind;canImport:boolean}){
 const spec=importSpecs[kind],router=useRouter(),generation=useRef(0),fileInput=useRef<HTMLInputElement>(null);
 const [previewVersion,setPreviewVersion]=useState(0);
 const [rows,setRows]=useState<ImportRow[]>([]),[issues,setIssues]=useState<ImportIssue[]>([]),[plan,setPlan]=useState<ImportPlan[]>();
 const [message,setMessage]=useState(""),[busy,setBusy]=useState(false),[filename,setFilename]=useState(""),[paste,setPaste]=useState(""),[mode,setMode]=useState("add");
 const parse=(grid:(string|number|null)[][])=>{const r=parseImportGrid(grid,kind);setRows(r.rows);setIssues(r.issues);setPlan(undefined);setMessage("");};
 function downloadCsv(){const a=document.createElement("a"),url=URL.createObjectURL(new Blob([csvOutput(spec.headers,[])],{type:"text/csv;charset=utf-8"}));a.href=url;a.download="tv-eam-"+kind+".csv";a.click();URL.revokeObjectURL(url);}
 async function choose(file:File|undefined){
  const token=++generation.current;setPlan(undefined);setRows([]);setIssues([]);setMessage("");setFilename(file?.name??"");setPaste("");if(!file)return;setBusy(true);
  try{
   let grid:(string|number|null)[][];
   if(/\.xlsx$/i.test(file.name)){if(file.size>1048576)throw Error("Tệp Excel tối đa 1 MiB.");const {readImportXlsx}=await import("@/lib/xlsx-import");grid=readImportXlsx(new Uint8Array(await file.arrayBuffer()),kind);}
   else if(/\.csv$/i.test(file.name)){if(file.size>262144)throw Error("Tệp CSV tối đa 256 KiB.");const text=await file.text(),line=text.split(/\r?\n/)[0];grid=parseCsv(text,line.includes(";")?";":",");}
   else throw Error("Chọn tệp .xlsx hoặc .csv. Tệp Excel cũ .xls cần lưu lại thành .xlsx.");
   if(token===generation.current)parse(grid);
  }catch(error){if(token===generation.current)setMessage(error instanceof Error?error.message:"Không đọc được tệp.");}
  finally{if(token===generation.current)setBusy(false);}
 }
 async function preview(){
  if(busy||issues.length||!rows.length)return;setBusy(true);setPlan(undefined);setMessage("");
  try{const data=new FormData();data.set("workspace",workspace);data.set("kind",kind);data.set("rows",JSON.stringify(rows));const r=await previewTable(data);setMessage(r.message);if(r.ok&&r.plan){setPlan(r.plan);setPreviewVersion(v=>v+1);}}catch{setMessage("Chưa kết nối được để xem trước. Chưa lưu dữ liệu.");}finally{setBusy(false);}
 }
 const changes=plan?.filter(p=>p.action==="update").length??0,existing=plan?.filter(p=>p.action!=="add").length??0;
 return <section className="panel" id="nhap-tu-tep"><h2>Nhập từ bảng dữ liệu · {spec.title}</h2><p>{spec.hint}</p>
  <div className="flex flex-wrap gap-3"><a className="button" href="/api/import-template">Tải bộ mẫu Excel</a><button type="button" className="button-secondary" onClick={downloadCsv}>Tải mẫu CSV</button></div>
  <p className="muted">Mở trang <strong>{spec.sheet}</strong> trong bộ mẫu Excel, điền từ dòng 2 và giữ nguyên tiêu đề cột. Tối đa 500 dòng mỗi lô. Tệp không có dòng ví dụ để tránh nhập nhầm số liệu mẫu.</p>
  {!canImport?<p>Bạn được tải mẫu; chưa có quyền nhập nhóm dữ liệu này trong khu vực đang chọn.</p>:<>
   <fieldset disabled={busy} className="space-y-3"><label>Chọn tệp Excel hoặc CSV<input ref={fileInput} type="file" accept=".xlsx,.csv" onChange={e=>void choose(e.target.files?.[0])}/></label>
    <details><summary>Hoặc dán bảng đã sao chép từ Excel</summary><label>Bảng dữ liệu có tiêu đề cột<textarea rows={5} value={paste} onChange={e=>{++generation.current;setPaste(e.target.value);setPlan(undefined);setRows([]);setIssues([]);setFilename("");}}/></label><button type="button" onClick={()=>{try{parse(parseCsv(paste,paste.split(/\r?\n/)[0].includes("\t")?"\t":paste.split(/\r?\n/)[0].includes(";")?";":","));}catch(error){setMessage(error instanceof Error?error.message:"Bảng không hợp lệ.");}}}>Đọc bảng đã dán</button></details>
    <p>{filename}{rows.length?" · "+rows.length+" dòng đã đọc":""}</p>
    {issues.length>0&&<div role="alert"><p>Có {issues.length} lỗi. Sửa lại tệp rồi chọn lại; chưa lưu dữ liệu.</p><div className="overflow-x-auto"><table><thead><tr><th>Dòng Excel</th><th>Cột</th><th>Lỗi</th></tr></thead><tbody>{issues.slice(0,100).map((r,i)=><tr key={i}><td>{r.line}</td><td>{r.column}</td><td>{r.message}</td></tr>)}</tbody></table></div>{issues.length>100&&<p>Đang hiển thị 100 lỗi đầu tiên.</p>}</div>}
    <button type="button" disabled={!rows.length||Boolean(issues.length)} onClick={()=>void preview()}>{busy?"Đang kiểm tra…":"Kiểm tra và xem trước"}</button>
   </fieldset>
   <p role="status" aria-live="polite">{message}</p>
   {plan&&<><p><strong>{plan.filter(p=>p.action==="add").length} dòng mới · {changes} dòng thay đổi · {plan.filter(p=>p.action==="same").length} dòng không đổi</strong></p>
    <div className="overflow-x-auto"><table><thead><tr><th>Xử lý</th>{spec.headers.map(h=><th key={h}>{h}</th>)}<th>Dữ liệu đang có</th></tr></thead><tbody>{plan.map((p,i)=><tr key={i}><td>{p.action==="add"?"Thêm mới":p.action==="same"?"Không đổi":"Cập nhật"}</td>{rowCells(p.row,kind).map((v,j)=><td key={j}>{v===null?"Để trống":String(v)}</td>)}<td>{p.previous?rowCells(p.previous,kind).map((v,j)=><p key={j}>{spec.headers[j]}: {v===null?"Để trống":String(v)}</p>):"Chưa có"}</td></tr>)}</tbody></table></div>
    <label>Cách nhập<select disabled={busy} value={mode} onChange={e=>setMode(e.target.value)}><option value="add">Chỉ thêm dòng mới</option><option value="replace">Thêm mới và cập nhật dòng đã có</option></select></label>
    {mode==="add"&&existing>0?<p role="alert">Có {existing} dòng đã tồn tại. Chọn chế độ cập nhật và đối chiếu bản xem trước, hoặc bỏ các dòng đó khỏi tệp.</p>:<AsyncForm key={kind+mode+previewVersion} action={commitTable} onPendingChange={setBusy} label={"Xác nhận nhập "+plan.length+" dòng"} resetLabel="Nhập tệp khác" onSuccess={()=>router.refresh()} onReset={()=>{setPlan(undefined);setRows([]);setFilename("");setPaste("");if(fileInput.current)fileInput.current.value="";}}>
     <input name="workspace" type="hidden" value={workspace}/><input name="kind" type="hidden" value={kind}/><input name="mode" type="hidden" value={mode}/><input name="plan" type="hidden" value={JSON.stringify(plan.map(p=>({row:p.row,expected:p.expected})))}/>
     {mode==="replace"&&<label className="catalog-confirm"><input type="checkbox" name="confirmed" required/>Tôi đã đối chiếu và đồng ý thay thông tin hoặc số liệu của các dòng đã có trong bản xem trước.</label>}
     <p className="catalog-warning">Nhập cả lô trong một lần: lỗi một dòng thì không ghi dòng nào. Không xóa dòng ngoài tệp. Cập nhật số liệu tháng là thay giá trị tháng, không cộng thêm một lần nữa.</p>
    </AsyncForm>}
   </>}
  </>}
 </section>;
}
