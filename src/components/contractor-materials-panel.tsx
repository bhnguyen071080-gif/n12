"use client";
import {useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {AsyncForm} from "./async-form";
import {saveContractorMaterial} from "@/app/contractor-materials/actions";
import {formatNumber} from "@/lib/domain";
import {formatDateVi,warrantyState,warrantyStateLabels,type ContractorMaterialRow,type WarrantyState} from "@/lib/contractor-materials";
import {equipmentLabel} from "@/lib/equipment-display";

type EquipmentOption={id:string;code:string;name:string};

export function ContractorMaterialsPanel({workspace,equipment,rows,today}:{workspace:string;equipment:EquipmentOption[];rows:ContractorMaterialRow[];today:string}){
 const router=useRouter(),[term,setTerm]=useState(""),[warranty,setWarranty]=useState<""|WarrantyState>("");
 const prepared=useMemo(()=>rows.map(row=>({...row,warranty_state:warrantyState(row.warranty_ends_on,today)})),[rows,today]);
 const filtered=useMemo(()=>prepared.filter(row=>(!term||`${row.material_name} ${row.contractor_name} ${row.equipment_name} ${row.equipment_code}`.toLocaleLowerCase("vi").includes(term.toLocaleLowerCase("vi")))&&(!warranty||row.warranty_state===warranty)),[prepared,term,warranty]);
 const counts=useMemo(()=>prepared.reduce((acc,row)=>{acc[row.warranty_state]++;return acc;},{active:0,due_soon:0,expired:0}),[prepared]);
 return <div className="contractor-materials space-y-5">
  <section className="panel contractor-intro"><div><p className="eyebrow">VẬT TƯ DO ĐƠN VỊ SỬA CHỮA CẤP</p><h1>Theo dõi vật tư nhà thầu</h1><p>Tách riêng khỏi phiếu lĩnh kho. Vật tư đã lắp lên phương tiện được xem là đạt; hệ thống tập trung theo dõi lịch sử lắp đặt và thời hạn bảo hành.</p></div><span className="plan-status">Nguồn mẫu VT_DVSC</span></section>
  <section className="stats-grid contractor-stats"><article className="stat-card"><strong>{prepared.length}</strong><p>Tổng số dòng</p></article><article className="stat-card"><strong>{counts.active}</strong><p>Còn bảo hành</p></article><article className="stat-card"><strong>{counts.due_soon}</strong><p>Gần tới hạn</p></article><article className="stat-card"><strong>{counts.expired}</strong><p>Đã hết hạn</p></article></section>
  <section className="panel"><details><summary className="contractor-form-summary">Ghi nhận vật tư nhà thầu mới</summary><div className="contractor-form-body"><AsyncForm action={saveContractorMaterial} label="Lưu vật tư nhà thầu" resetOnNew resetLabel="Nhập dòng tiếp theo" onSuccess={()=>router.refresh()}>
   <input type="hidden" name="workspace" value={workspace}/><div className="contractor-form-grid">
    <label>Phương tiện *<select name="equipment_id" required><option value="">Chọn phương tiện</option>{equipment.map(item=><option key={item.id} value={item.id}>{equipmentLabel(item)}</option>)}</select></label>
    <label>Nhà thầu / đơn vị cấp<input name="contractor_name" maxLength={200} placeholder="Có thể bổ sung sau"/></label>
    <label>Tên vật tư *<input name="material_name" required maxLength={300}/></label><label>Đơn vị *<input name="unit" required maxLength={40} placeholder="cái, vòng, bộ…"/></label>
    <label>Số lượng *<input name="quantity" type="number" min="0.001" step="0.001" required/></label><label>Ngày ký / nghiệm thu *<input name="signed_on" type="date" defaultValue={today} required/></label>
    <label>Thời gian bảo hành (tháng) *<input name="warranty_months" type="number" min="0" max="120" defaultValue="0" required/></label>
    <label className="contractor-wide">Vị trí lắp đặt / ghi chú<input name="notes" maxLength={1000}/></label>
   </div>
  </AsyncForm></div></details></section>
  <section className="panel"><div className="section-heading"><div><p className="eyebrow">KIỂM SOÁT THỜI HẠN BẢO HÀNH</p><h2>Danh sách vật tư nhà thầu</h2></div><div className="table-actions no-print"><span className="count-chip">{filtered.length} / {prepared.length} dòng</span><button type="button" className="button-secondary" onClick={()=>window.print()}>Xem trước / In danh sách</button></div></div>
   <div className="contractor-filters"><label>Tìm kiếm<input value={term} onChange={event=>setTerm(event.target.value)} placeholder="Vật tư, nhà thầu, phương tiện…"/></label><label>Thời hạn<select value={warranty} onChange={event=>setWarranty(event.target.value as ""|WarrantyState)}><option value="">Tất cả</option>{Object.entries(warrantyStateLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>
   <div className="overflow-x-auto"><table><thead><tr><th>Vật tư</th><th>Phương tiện</th><th>Số lượng</th><th>Nhà thầu</th><th>Ngày ký</th><th>Hạn BH</th><th>Thời hạn</th><th>Ghi chú</th></tr></thead><tbody>{filtered.map(row=><tr key={row.id} className={`contractor-alert-${row.warranty_state}`}><td><strong>{row.material_name}</strong></td><td><strong>{row.equipment_name}</strong><small>Mã gõ tắt: {row.equipment_code}</small></td><td>{formatNumber(row.quantity,3)} {row.unit}</td><td>{row.contractor_name||"Chưa ghi"}</td><td>{formatDateVi(row.signed_on)}</td><td>{formatDateVi(row.warranty_ends_on)}<small>{row.warranty_months} tháng</small></td><td><span className={`contractor-badge contractor-${row.warranty_state}`}>{warrantyStateLabels[row.warranty_state]}</span></td><td>{row.notes||"—"}</td></tr>)}</tbody></table></div>
   {!filtered.length&&<p>Không có dòng vật tư phù hợp bộ lọc.</p>}
  </section>
 </div>;
}

