"use client";
import Link from "next/link";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {AsyncForm} from "./async-form";
import {saveEquipment} from "@/app/catalog/actions";
import {equipmentCategories,categoryLabels,baseStatusLabels} from "@/lib/equipment-catalog";
import type {Equipment} from "@/lib/domain";
export function EquipmentEditor({workspace,equipment}:{workspace:string;equipment?:Equipment}){
 const router=useRouter(),[code,setCode]=useState(equipment?.code??""),[saved,setSaved]=useState<string>();
 return <section className="panel catalog-editor"><h2>{equipment?"Chỉnh sửa phương tiện":"Thêm phương tiện"}</h2><p className="muted">Chỉ nhập thông tin đã đối chiếu. Số chế tạo và năm sản xuất chưa rõ có thể để trống.</p>
  <AsyncForm action={saveEquipment} label={equipment?"Lưu thay đổi":"Lưu phương tiện"} resetOnNew={!equipment} resetLabel={equipment?"Tiếp tục chỉnh sửa":"Nhập phương tiện tiếp theo"}
   onSuccess={r=>{setSaved(r.id);router.refresh();}} onReset={()=>{setSaved(undefined);if(!equipment)setCode("");}}>
   <input type="hidden" name="workspace" value={workspace}/><input type="hidden" name="equipment_id" value={equipment?.id??""}/><input type="hidden" name="version" value={equipment?.catalog_version??""}/>
   <div className="catalog-fields"><label>Mã phương tiện *<input name="code" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} readOnly={Boolean(equipment)} required maxLength={40} pattern="[A-Z0-9_-]+" aria-describedby="catalog-code-help"/></label><label>Tên phương tiện *<input name="name" defaultValue={equipment?.name??""} required maxLength={200}/></label>
    <label>Loại thiết bị *<select name="category" defaultValue={equipment?.category??""} required><option value="" disabled>Chọn loại thiết bị</option>{equipmentCategories.map(k=><option key={k} value={k}>{categoryLabels[k]}</option>)}</select></label>
    <label>Trạng thái nền *<select name="base_status" defaultValue={equipment?.base_status??""} required aria-describedby="catalog-status-help"><option value="" disabled>Chọn trạng thái đã xác nhận</option>{Object.entries(baseStatusLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    <label>Số chế tạo<input name="serial" defaultValue={equipment?.serial_number??""} maxLength={100}/></label><label>Năm sản xuất<input name="year" type="number" min={1900} max={new Date().getFullYear()} step={1} defaultValue={equipment?.manufacture_year??""}/></label>
    <label>Giờ ban đầu đã đối chiếu *<input name="initial_hours" type="number" step="0.01" min={0} max={1000000000} required readOnly={Boolean(equipment)} defaultValue={equipment?.initial_hours??""} aria-describedby="catalog-hours-help"/></label>
   </div>
   <p className="muted" id="catalog-code-help">Mã không đổi sau khi lưu để giữ liên kết lý lịch và số liệu tháng.</p><p className="muted" id="catalog-status-help">Trạng thái sửa chữa, bảo dưỡng và chờ vật tư do nghiệp vụ tự tính; không ghi đè tại đây.</p>
   <p className="catalog-warning" id="catalog-hours-help">Giờ gốc trước tháng bắt đầu nhập số liệu. Không dùng 0 thay cho “chưa biết”, không cộng lại các tháng đã nằm trong giờ gốc. Khi sửa danh mục, giờ này được giữ nguyên.</p>
   {!equipment && <label className="catalog-confirm"><input type="checkbox" name="baseline_confirmed" required/>Tôi đã đối chiếu giờ ban đầu và mốc nhập số liệu, tránh cộng trùng.</label>}
   <label>Mã tham chiếu từ nguồn cũ<textarea name="aliases" rows={2} defaultValue={equipment?.source_codes?.join("; ")??""} aria-describedby="catalog-alias-help"/></label><p className="muted" id="catalog-alias-help">Tối đa 20 mã, cách nhau bằng dấu chấm phẩy. Giữ mã nguồn để đối chiếu; chưa tự cấu hình đồng bộ bảng tính hoặc vị trí lắp khung.</p>
   <label>Ghi chú<textarea name="notes" rows={3} maxLength={2000} defaultValue={equipment?.catalog_notes??""}/></label>
  </AsyncForm>{saved && <p className="mt-3"><Link href={"/catalog?workspace="+workspace+"&edit="+saved}>Mở thông tin vừa lưu</Link> · <Link href={"/equipment/"+code.trim()+"?workspace="+workspace}>Xem hồ sơ phương tiện</Link></p>}
 </section>;
}
