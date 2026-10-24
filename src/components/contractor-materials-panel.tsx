"use client";
import {useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {AsyncForm} from "./async-form";
import {saveContractorMaterial,updateContractorMaterialQuality} from "@/app/contractor-materials/actions";
import {formatNumber} from "@/lib/domain";
import {formatDateVi,qualityStatusLabels,warrantyState,warrantyStateLabels,type ContractorMaterialRow,type QualityStatus,type WarrantyState} from "@/lib/contractor-materials";

type EquipmentOption={id:string;code:string;name:string};
const qualityOptions=Object.entries(qualityStatusLabels) as [QualityStatus,string][];

export function ContractorMaterialsPanel({workspace,equipment,rows,today}:{workspace:string;equipment:EquipmentOption[];rows:ContractorMaterialRow[];today:string}){
 const router=useRouter(),[term,setTerm]=useState(""),[warranty,setWarranty]=useState<""|WarrantyState>(""),[quality,setQuality]=useState<""|QualityStatus>("");
 const prepared=useMemo(()=>rows.map(row=>({...row,warranty_state:warrantyState(row.warranty_ends_on,today)})),[rows,today]);
 const filtered=useMemo(()=>prepared.filter(row=>(!term||`${row.material_name} ${row.contractor_name} ${row.equipment_code}`.toLocaleLowerCase("vi").includes(term.toLocaleLowerCase("vi")))&&(!warranty||row.warranty_state===warranty)&&(!quality||row.quality_status===quality)),[prepared,term,warranty,quality]);
 const counts=useMemo(()=>prepared.reduce((acc,row)=>{acc[row.warranty_state]++;if(row.quality_status==="pending"||row.quality_status==="rejected")acc.quality++;return acc;},{active:0,due_soon:0,expired:0,quality:0}),[prepared]);
 return <div className="contractor-materials space-y-5">
  <section className="panel contractor-intro"><div><p className="eyebrow">VẬT TƯ DO ĐƠN VỊ SỬA CHỮA CẤP</p><h1>Theo dõi vật tư nhà thầu</h1><p>Tách riêng khỏi phiếu lĩnh kho. Hệ thống theo dõi vật tư gắn với phương tiện, hạn bảo hành và kết quả kiểm tra chất lượng.</p></div><span className="plan-status">Nguồn mẫu VT_DVSC</span></section>
  <section className="stats-grid contractor-stats"><article className="stat-card"><strong>{prepared.length}</strong><p>Tổng số dòng</p></article><article className="stat-card"><strong>{counts.due_soon}</strong><p>Gần tới hạn</p></article><article className="stat-card"><strong>{counts.expired}</strong><p>Đã hết hạn</p></article><article className="stat-card"><strong>{counts.quality}</strong><p>Cần xử lý chất lượng</p></article></section>
  <section className="panel"><details><summary className="contractor-form-summary">Ghi nhận vật tư nhà thầu mới</summary><div className="contractor-form-body"><AsyncForm action={saveContractorMaterial} label="Lưu vật tư nhà thầu" resetOnNew resetLabel="Nhập dòng tiếp theo" onSuccess={()=>router.refresh()}>
   <input type="hidden" name="workspace" value={workspace}/><div className="contractor-form-grid">
    <label>Phương tiện *<select name="equipment_id" required><option value="">Chọn phương tiện</option>{equipment.map(item=><option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
    <label>Nhà thầu / đơn vị cấp<input name="contractor_name" maxLength={200} placeholder="Có thể bổ sung sau"/></label>
    <label>Tên vật tư *<input name="material_name" required maxLength={300}/></label><label>Đơn vị *<input name="unit" required maxLength={40} placeholder="cái, vòng, bộ…"/></label>
    <label>Số lượng *<input name="quantity" type="number" min="0.001" step="0.001" required/></label><label>Ngày ký / nghiệm thu *<input name="signed_on" type="date" defaultValue={today} required/></label>
    <label>Thời gian bảo hành (tháng) *<input name="warranty_months" type="number" min="0" max="120" defaultValue="0" required/></label>
    <label>Kết quả chất lượng<select name="quality_status" defaultValue="pending">{qualityOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label>Ngày kiểm tra<input name="quality_checked_on" type="date" defaultValue={today}/></label><label>Ghi chú chất lượng<input name="quality_note" maxLength={1000}/></label>
    <label className="contractor-wide">Vị trí lắp đặt / ghi chú<input name="notes" maxLength={1000}/></label>
   </div>
  </AsyncForm></div></details></section>
  <section className="panel"><div className="section-heading"><div><p className="eyebrow">KIỂM SOÁT THỜI HẠN VÀ CHẤT LƯỢNG</p><h2>Danh sách vật tư nhà thầu</h2></div><span className="count-chip">{filtered.length} / {prepared.length} dòng</span></div>
   <div className="contractor-filters"><label>Tìm kiếm<input value={term} onChange={event=>setTerm(event.target.value)} placeholder="Vật tư, nhà thầu, phương tiện…"/></label><label>Thời hạn<select value={warranty} onChange={event=>setWarranty(event.target.value as ""|WarrantyState)}><option value="">Tất cả</option>{Object.entries(warrantyStateLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Chất lượng<select value={quality} onChange={event=>setQuality(event.target.value as ""|QualityStatus)}><option value="">Tất cả</option>{qualityOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>
   <div className="overflow-x-auto"><table><thead><tr><th>Vật tư</th><th>Phương tiện</th><th>Số lượng</th><th>Nhà thầu</th><th>Ngày ký</th><th>Hạn BH</th><th>Thời hạn</th><th>Chất lượng</th><th>Ghi chú</th></tr></thead><tbody>{filtered.map(row=><tr key={row.id} className={`contractor-alert-${row.warranty_state}`}><td><strong>{row.material_name}</strong></td><td>{row.equipment_code}<small>{row.equipment_name}</small></td><td>{formatNumber(row.quantity,3)} {row.unit}</td><td>{row.contractor_name||"Chưa ghi"}</td><td>{formatDateVi(row.signed_on)}</td><td>{formatDateVi(row.warranty_ends_on)}<small>{row.warranty_months} tháng</small></td><td><span className={`contractor-badge contractor-${row.warranty_state}`}>{warrantyStateLabels[row.warranty_state]}</span></td><td><span className={`contractor-badge quality-${row.quality_status}`}>{qualityStatusLabels[row.quality_status]}</span><details className="quality-update"><summary>Cập nhật</summary><AsyncForm action={updateContractorMaterialQuality} label="Lưu kết quả" onSuccess={()=>router.refresh()}><input type="hidden" name="workspace" value={workspace}/><input type="hidden" name="id" value={row.id}/><label>Trạng thái<select name="quality_status" defaultValue={row.quality_status}>{qualityOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Ngày kiểm tra<input name="quality_checked_on" type="date" defaultValue={row.quality_checked_on??today}/></label><label>Nhận xét<textarea name="quality_note" maxLength={1000} defaultValue={row.quality_note}/></label></AsyncForm></details></td><td>{row.notes||row.quality_note||"—"}</td></tr>)}</tbody></table></div>
   {!filtered.length&&<p>Không có dòng vật tư phù hợp bộ lọc.</p>}
  </section>
 </div>;
}

