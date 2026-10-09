"use client";
import {useState} from "react";
import {confirmFault,convertInspection,saveQuick} from "@/app/actions";
import {AsyncForm} from "./async-form";
import {causes,causeLabels,localInputNow} from "@/lib/domain";
export function QuickEntry({equipment,mode}:{equipment:string;mode:"inspection"|"fault"}){
 const [kind,setKind]=useState(mode),[abnormal,setAbnormal]=useState(false),[inspection,setInspection]=useState<string>();
 return <section className="panel"><h2>Kiểm tra / báo hỏng nhanh</h2>
  <div className="flex gap-3"><button type="button" onClick={()=>setKind("inspection")}>KT · Kiểm tra</button><button type="button" onClick={()=>setKind("fault")}>SC · Báo hỏng</button></div>
  <AsyncForm key={kind} action={saveQuick} onSuccess={r=>{if(kind==="inspection")setInspection(r.id);}}>
   <input type="hidden" name="equipment" value={equipment}/><input type="hidden" name="kind" value={kind}/>
   <label>Thời gian thực tế (UTC+7)<input type="datetime-local" name="actual_time" defaultValue={localInputNow()} required/></label>
   <label>{kind==="inspection"?"Kết quả kiểm tra":"Hiện tượng hư hỏng"}<textarea name="notes" rows={3} required maxLength={4000}/></label>
   {kind==="inspection"?<label><input type="checkbox" name="abnormal" checked={abnormal} onChange={e=>setAbnormal(e.target.checked)}/> Có bất thường</label>:
    <label><input type="checkbox" name="stopped"/> Phương tiện đang dừng vì bất thường này</label>}
  </AsyncForm>
  {kind==="inspection" && abnormal && inspection && <AsyncForm action={convertInspection} label="Chuyển một lần sang hồ sơ sửa chữa"><input type="hidden" name="case" value={inspection}/></AsyncForm>}
 </section>;
}
export function ConfirmFault({id}:{id:string}){return <AsyncForm action={confirmFault} label="Xác nhận sự cố">
 <input type="hidden" name="incident" value={id}/><label>Nguyên nhân chính<select name="cause">{causes.map(c=><option value={c} key={c}>{causeLabels[c]}</option>)}</select></label>
 </AsyncForm>;}
