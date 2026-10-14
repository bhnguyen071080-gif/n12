"use client";
import {useRouter} from "next/navigation";
import {AsyncForm} from "./async-form";
import {confirmBaseline} from "@/app/monthly/actions";
import {formatNumber} from "@/lib/domain";
import {monthLabel} from "@/lib/monthly-hours";
export function OperatingBaseline({equipment,code,hours,start,accumulated,canConfirm}:{equipment:string;code:string;hours:number|null;start:string|null;accumulated:number|null;canConfirm:boolean}){
 const router=useRouter();
 return <section className="panel" id="moc-gio"><div className="section-heading"><h2>Mốc giờ gốc · {code}</h2><span className="count-chip">{hours===null?"Chưa đối chiếu":start?"Đã xác nhận":"Chưa xác nhận mốc tháng"}</span></div>
  <p>Giờ gốc là tổng giờ hoạt động trước tháng đầu được theo dõi ở đây. Giờ chạy từng tháng được ghi riêng bên dưới.</p>
  {hours===null?<p className="catalog-warning">Chưa có giờ gốc đã đối chiếu. Bạn vẫn có thể ghi nhận giờ chạy từng tháng; giờ lũy kế chưa được xác định. Không coi giờ gốc chưa biết là 0.</p>:<div className="catalog-fields"><p>Giờ gốc đã lưu: <strong>{formatNumber(hours)} giờ</strong></p><p>Giờ lũy kế theo dữ liệu hiện có: <strong>{formatNumber(accumulated)} giờ</strong></p></div>}
  {start?<><p>Tháng bắt đầu cộng giờ: <strong>{monthLabel(start)}</strong>.</p><p className="muted">Mốc đã xác nhận được giữ nguyên. Nếu cần hiệu chỉnh, phải đối chiếu riêng; không sửa trong danh mục phương tiện. Lũy kế chỉ phản ánh các tháng đã nhập, chưa khẳng định các tháng thiếu là 0 giờ.</p></>:
   canConfirm?<AsyncForm action={confirmBaseline} label="Xác nhận mốc giờ" resetLabel="Xem lại biểu mẫu" onSuccess={()=>router.refresh()}>
    <input name="equipment" type="hidden" value={equipment}/>
    <div className="catalog-fields"><label>Giờ gốc đã đối chiếu *<input name="initial_hours" type="number" step="0.01" min={0} max={1000000000} required defaultValue={hours??""} readOnly={hours!==null}/></label>
     <label>Tháng bắt đầu theo dõi *<input name="start_month" type="month" min="2000-01" max="2199-12" required/></label></div>
    <p className="catalog-warning">Giờ gốc phải dừng trước tháng đã chọn. Không nhập lại những tháng đã nằm trong giờ gốc. Sau khi xác nhận, biểu mẫu này không cho sửa lại mốc.</p>
    <label className="catalog-confirm"><input type="checkbox" name="baseline_confirmed" required/>Tôi đã đối chiếu giờ gốc và tháng bắt đầu, không cộng trùng.</label>
   </AsyncForm>:<p>Người quản lý khu vực sẽ xác nhận giờ gốc và tháng bắt đầu.</p>}
 </section>;
}
