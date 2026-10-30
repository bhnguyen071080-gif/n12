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
 return <section className="panel catalog-editor" aria-label={equipment?"Chỉnh sửa phương tiện":"Thêm phương tiện mới"}>
  <AsyncForm action={saveEquipment} showDefaultSubmit={false} resetOnNew={!equipment} resetLabel={equipment?"Tiếp tục chỉnh sửa":"Nhập phương tiện tiếp theo"}
   onSuccess={r=>{setSaved(r.id);router.refresh();}} onReset={()=>{setSaved(undefined);if(!equipment)setCode("");}}>
   <input type="hidden" name="workspace" value={workspace}/><input type="hidden" name="equipment_id" value={equipment?.id??""}/><input type="hidden" name="version" value={equipment?.catalog_version??""}/>
   <div className="catalog-editor-actions no-print">
    {equipment?<Link className="button catalog-new-button" href={`/catalog?workspace=${workspace}`}>Thêm mới</Link>:<button type="submit">Thêm mới</button>}
    <button type={equipment?"submit":"button"} disabled={!equipment}>Cập nhật</button>
    {equipment?<Link className="button button-secondary" href={`/catalog?workspace=${workspace}`}>Hủy</Link>:<button type="button" className="button-secondary" disabled>Hủy</button>}
   </div>
   <div className="catalog-form-grid"><label>Tên PTTB (*)<input name="name" defaultValue={equipment?.name??""} required maxLength={200} placeholder="Nhập tên phương tiện thiết bị"/></label><label>Mã PTTB<input name="code" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} readOnly={Boolean(equipment)} required maxLength={40} pattern="[A-Z0-9_-]+" placeholder="Nhập mã gõ tắt" aria-describedby="catalog-code-help"/></label>
    <label>Nhóm PTTB<select name="category" defaultValue={equipment?.category??""} required><option value="" disabled>Chọn nhóm PTTB</option>{equipmentCategories.map(k=><option key={k} value={k}>{categoryLabels[k]}</option>)}</select></label>
    <label>Trạng thái<select name="base_status" defaultValue={equipment?.base_status??"available"} required aria-describedby="catalog-status-help">{Object.entries(baseStatusLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    <label>Số chế tạo<input name="serial" defaultValue={equipment?.serial_number??""} maxLength={100} placeholder="Nhập số chế tạo"/></label><label>Năm sản xuất<input name="year" type="number" min={1900} max={new Date().getFullYear()} step={1} defaultValue={equipment?.manufacture_year??""} placeholder="yyyy"/></label>
    <label>Mã tham chiếu<input name="aliases" defaultValue={equipment?.source_codes?.join("; ")??""} placeholder="Các mã cũ, cách nhau bằng ;"/></label><label>Ghi chú<input name="notes" maxLength={2000} defaultValue={equipment?.catalog_notes??""} placeholder="Ghi chú nếu có"/></label>
   </div>
   <p className="catalog-editor-help muted" id="catalog-code-help">Tên PTTB là tên hiển thị chính; mã PTTB chỉ dùng để gõ tắt và không đổi sau khi lưu.</p><span id="catalog-status-help" className="sr-only">Trạng thái sửa chữa và bảo dưỡng được nghiệp vụ tự tính.</span>
  </AsyncForm>{saved && <p className="mt-3"><Link href={"/catalog?workspace="+workspace+"&edit="+saved}>Mở thông tin vừa lưu</Link> · <Link href={"/equipment/"+code.trim()+"?workspace="+workspace}>Xem hồ sơ phương tiện</Link></p>}
 </section>;
}

