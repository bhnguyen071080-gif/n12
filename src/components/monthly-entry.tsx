"use client";
import {saveMonthly} from "@/app/actions";
import {AsyncForm} from "./async-form";
import {monthStart,type MonthlyKind} from "@/lib/domain";
export function MonthlyEntry({workspace,kind,codes,cargoCodes,initialCode="",initialMonth="",initialValue}:{workspace:string;kind:MonthlyKind;codes:string[];cargoCodes:string[];initialCode?:string;initialMonth?:string;initialValue?:number|null}){
 function prepare(data:FormData){
  const base={equipment_code:String(data.get("equipment_code")),month:monthStart(String(data.get("month")))};
  const n=(field:string)=>{const s=String(data.get(field)??"");if(!/^\d+(\.\d+)?$/.test(s))throw new Error("Số không hợp lệ");return Number(s);};
  const row=kind==="hours"?{...base,operating_hours:n("operating_hours")}:kind==="container"?{...base,boxes:n("boxes")}:
   {...base,cargo_code:String(data.get("cargo_code")),quantity:n("quantity")};
  data.set("rows",JSON.stringify([row]));
 }
 return <div className="monthly-entry-grid">
  <section className="panel monthly-entry-compact" id="cap-nhat-thang"><div className="section-heading"><div><p className="eyebrow">CẬP NHẬT DỮ LIỆU</p><h2>{initialMonth?"Điều chỉnh tháng đã ghi":"Nhập nhanh một tháng"}</h2></div>{initialMonth&&<span className="count-chip">Lưu sẽ thay số cũ</span>}</div>
   <p className="muted">Mỗi phương tiện chỉ có một giá trị trong một tháng. Nhập lại cùng phương tiện và tháng sẽ cập nhật số liệu, không tạo dòng trùng.</p>
   <AsyncForm action={saveMonthly} prepare={prepare} resetOnNew resetLabel="Nhập tháng khác"><input type="hidden" name="workspace" value={workspace}/><input type="hidden" name="kind" value={kind}/>
    <label>Phương tiện<select name="equipment_code" defaultValue={initialCode||codes[0]} required>{codes.map(c=><option key={c}>{c}</option>)}</select></label>
    <label>Tháng<input type="month" name="month" defaultValue={initialMonth} required/></label>
    {kind==="hours"?<label>Giờ hoạt động trong tháng<input name="operating_hours" defaultValue={initialValue??undefined} type="number" step="0.01" min="0" required/></label>:kind==="container"?<>
     <label>Số container (chiếc / Boxes)<input name="boxes" defaultValue={initialValue??undefined} type="number" step="1" min="0" required/></label>
</>:<>
     <label>Loại hàng<select name="cargo_code" required>{cargoCodes.map(c=><option key={c}>{c}</option>)}</select></label>
     <label>Số lượng theo đơn vị loại hàng<input name="quantity" type="number" step="0.001" min="0" required/></label></>}
   </AsyncForm>
  </section>
 </div>;
}

