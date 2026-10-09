"use client";
import {saveLifeItem} from "@/app/actions";
import {AsyncForm} from "./async-form";
import {localInputNow} from "@/lib/domain";
export function LifeEntry({equipment}:{equipment:{id:string;code:string}[]}){
 return <section className="panel"><h2>Đăng ký mốc định mức bộ phận</h2><p>Giờ khi lắp là số đồng hồ thực tế. Nếu vị trí đã có bộ phận đang dùng, cần kết thúc lần lắp cũ trước khi đăng ký thay mới.</p>
  <AsyncForm action={saveLifeItem}>
   <label>Phương tiện<select name="equipment">{equipment.map(e=><option key={e.id} value={e.id}>{e.code}</option>)}</select></label>
   <label>Vị trí / mã bộ phận<input name="slot" required maxLength={40}/></label><label>Tên bộ phận<input name="name" required maxLength={200}/></label>
   <label>Nhóm<select name="component"><option value="CABLE">Cáp</option><option value="CRANE_FRAME_HAMMER">Búa khung cẩu</option><option value="OTHER">Khác</option></select></label>
   <label>Ngày giờ lắp thực tế<input type="datetime-local" name="installed_at" defaultValue={localInputNow()} required/></label>
   <label>Giờ đồng hồ khi lắp<input name="meter" type="number" min="0" step="0.01" required/></label>
   <label>Định mức sử dụng (giờ)<input name="limit" type="number" min="0.01" step="0.01" required/></label>
   <label>Cảnh báo trước (giờ)<input name="warning" type="number" min="0" step="0.01" defaultValue="25" required/></label>
  </AsyncForm>
 </section>;
}
