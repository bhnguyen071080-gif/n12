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
 return <section className="panel catalog-editor"><div className="section-heading"><div><h2>{equipment?`Chỉnh sửa: ${equipment.name}`:"Thêm phương tiện"}</h2><p className="muted">Tên đầy đủ dùng để hiển thị; mã phương tiện chỉ là mã gõ tắt và không đổi sau khi lưu.</p></div><Link className="button button-secondary" href={`/catalog?workspace=${workspace}`}>Hủy</Link></div>
  <AsyncForm action={saveEquipment} label={equipment?"Lưu thay đổi":"Lưu phương tiện"} resetOnNew={!equipment} resetLabel={equipment?"Tiếp tục chỉnh sửa":"Nhập phương tiện tiếp theo"}
   onSuccess={r=>{setSaved(r.id);router.refresh();}} onReset={()=>{setSaved(undefined);if(!equipment)setCode("");}}>
   <input type="hidden" name="workspace" value={workspace}/><input type="hidden" name="equipment_id" value={equipment?.id??""}/><input type="hidden" name="version" value={equipment?.catalog_version??""}/>
   <div className="catalog-fields"><label>Tên phương tiện đầy đủ *<input name="name" defaultValue={equipment?.name??""} required maxLength={200} placeholder="Ví dụ: Khung cẩu No57"/></label><label>Mã gõ tắt *<input name="code" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} readOnly={Boolean(equipment)} required maxLength={40} pattern="[A-Z0-9_-]+" placeholder="Ví dụ: N57" aria-describedby="catalog-code-help"/></label>
    <label>Loại thiết bị *<select name="category" defaultValue={equipment?.category??""} required><option value="" disabled>Chọn loại thiết bị</option>{equipmentCategories.map(k=><option key={k} value={k}>{categoryLabels[k]}</option>)}</select></label>
    <label>Trạng thái nền *<select name="base_status" defaultValue={equipment?.base_status??""} required aria-describedby="catalog-status-help"><option value="" disabled>Chọn trạng thái đã xác nhận</option>{Object.entries(baseStatusLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    <label>Số chế tạo<input name="serial" defaultValue={equipment?.serial_number??""} maxLength={100}/></label><label>Năm sản xuất<input name="year" type="number" min={1900} max={new Date().getFullYear()} step={1} defaultValue={equipment?.manufacture_year??""}/></label>
   </div>
   <p className="muted" id="catalog-code-help">Mã không đổi sau khi lưu để giữ liên kết lý lịch và số liệu tháng.</p><p className="muted" id="catalog-status-help">Trạng thái sửa chữa, bảo dưỡng và chờ vật tư do nghiệp vụ tự tính; không ghi đè tại đây.</p>
   <p className="muted">Danh mục không yêu cầu nhập giờ máy. Giờ gốc và số liệu tháng được quản lý riêng tại <Link href={"/monthly?workspace="+workspace+"&kind=hours"+(equipment?"&equipment="+equipment.id:"")}>Giám sát giờ hoạt động</Link>.</p>
   <label>Mã tham chiếu từ nguồn cũ<textarea name="aliases" rows={2} defaultValue={equipment?.source_codes?.join("; ")??""} aria-describedby="catalog-alias-help"/></label><p className="muted" id="catalog-alias-help">Tối đa 20 mã, cách nhau bằng dấu chấm phẩy. Giữ mã nguồn để đối chiếu; chưa tự cấu hình đồng bộ bảng tính hoặc vị trí lắp khung.</p>
   <label>Ghi chú<textarea name="notes" rows={3} maxLength={2000} defaultValue={equipment?.catalog_notes??""}/></label>
  </AsyncForm>{saved && <p className="mt-3"><Link href={"/catalog?workspace="+workspace+"&edit="+saved}>Mở thông tin vừa lưu</Link> · <Link href={"/equipment/"+code.trim()+"?workspace="+workspace}>Xem hồ sơ phương tiện</Link></p>}
 </section>;
}

