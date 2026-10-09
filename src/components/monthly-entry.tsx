"use client";
import {useState} from "react";
import {saveMonthly} from "@/app/actions";
import {AsyncForm} from "./async-form";
import {monthlyCsv} from "@/lib/csv";
import {monthStart,type MonthlyKind} from "@/lib/domain";
export function MonthlyEntry({workspace,kind,codes,cargoCodes}:{workspace:string;kind:MonthlyKind;codes:string[];cargoCodes:string[]}){
 const [csv,setCsv]=useState(""),[error,setError]=useState(""),[preview,setPreview]=useState("");
 const header=kind==="hours"?"equipment_code,month,operating_hours":kind==="container"?"equipment_code,month,boxes,teu":"equipment_code,month,cargo_code,quantity";
 function prepare(data:FormData){
  const base={equipment_code:String(data.get("equipment_code")),month:monthStart(String(data.get("month")))};
  const n=(field:string)=>{const s=String(data.get(field)??"");if(!/^\d+(\.\d+)?$/.test(s))throw new Error("Số không hợp lệ");return Number(s);};
  const row=kind==="hours"?{...base,operating_hours:n("operating_hours")}:kind==="container"?{...base,boxes:n("boxes"),teu:data.get("teu")?n("teu"):null}:
   {...base,cargo_code:String(data.get("cargo_code")),quantity:n("quantity")};
  data.set("rows",JSON.stringify([row]));
 }
 return <div className="grid gap-6 lg:grid-cols-2">
  <section className="panel"><h2>Nhập một tháng</h2>
   <AsyncForm action={saveMonthly} prepare={prepare}><input type="hidden" name="workspace" value={workspace}/><input type="hidden" name="kind" value={kind}/>
    <label>Phương tiện<select name="equipment_code" required>{codes.map(c=><option key={c}>{c}</option>)}</select></label>
    <label>Tháng<input type="month" name="month" required/></label>
    {kind==="hours"?<label>Tổng giờ hoạt động thực tế<input name="operating_hours" type="number" step="0.01" min="0" required/></label>:kind==="container"?<>
     <label>Số container (chiếc / Boxes)<input name="boxes" type="number" step="1" min="0" required/></label>
     <label>TEU (để trống nếu chưa biết)<input name="teu" type="number" step="0.01" min="0"/></label></>:<>
     <label>Loại hàng<select name="cargo_code" required>{cargoCodes.map(c=><option key={c}>{c}</option>)}</select></label>
     <label>Số lượng theo đơn vị loại hàng<input name="quantity" type="number" step="0.001" min="0" required/></label></>}
   </AsyncForm>
  </section>
  <section className="panel"><h2>Import CSV không nhập lại từng dòng</h2><p>Dấu chấm thập phân, không phân tách hàng nghìn. Header: <code>{header}</code>. Tối đa 1000 dòng/lô.</p>
   <label>Chọn CSV<input type="file" accept=".csv,text/csv" onChange={async e=>{
    const file=e.target.files?.[0];if(!file)return;if(file.size>262144){setError("File tối đa 256 KiB");return;}setCsv(await file.text());setPreview("");setError("");
   }}/></label>
   <label>Dữ liệu CSV<textarea value={csv} onChange={e=>{setCsv(e.target.value);setPreview("");setError("");}} rows={6}/></label>
   <button type="button" onClick={()=>{try{const rows=monthlyCsv(csv,kind);setPreview(JSON.stringify(rows.slice(0,5),null,2));setError("");}catch(e){setError(e instanceof Error?e.message:"CSV không hợp lệ");}}}>Kiểm tra và xem trước</button>
   <p role="alert">{error}</p>{preview && <><pre className="overflow-x-auto text-xs">{preview}</pre><AsyncForm action={saveMonthly}
    prepare={data=>data.set("rows",JSON.stringify(monthlyCsv(csv,kind)))} label="Xác nhận cập nhật toàn lô">
    <input type="hidden" name="workspace" value={workspace}/><input type="hidden" name="kind" value={kind}/>
   </AsyncForm></>}
  </section>
 </div>;
}
