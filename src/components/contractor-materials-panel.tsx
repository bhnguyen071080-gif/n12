"use client";
import {useDeferredValue,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {AsyncForm} from "./async-form";
import {saveContractorMaterial} from "@/app/contractor-materials/actions";
import {formatNumber} from "@/lib/domain";
import {formatDateVi,warrantyState,warrantyStateLabels,type ContractorMaterialRow,type WarrantyState} from "@/lib/contractor-materials";
import {equipmentLabel} from "@/lib/equipment-display";
import {TablePagination} from "./table-pagination";
import {paginate} from "@/lib/pagination";
import {ContractorMaterialsImport} from "./contractor-materials-import";

type EquipmentOption={id:string;code:string;name:string};
const pageSize=50;

export function ContractorMaterialsPanel({workspace,equipment,rows,today}:{workspace:string;equipment:EquipmentOption[];rows:ContractorMaterialRow[];today:string}){
 const router=useRouter(),[term,setTerm]=useState(""),[warranty,setWarranty]=useState<""|WarrantyState>(""),[equipmentId,setEquipmentId]=useState(""),[material,setMaterial]=useState(""),[from,setFrom]=useState(""),[to,setTo]=useState(""),[page,setPage]=useState(1),deferredTerm=useDeferredValue(term).toLocaleLowerCase("vi");
 const prepared=useMemo(()=>rows.map(row=>({...row,warranty_state:warrantyState(row.warranty_ends_on,today)})),[rows,today]);
 const materials=useMemo(()=>[...new Set(prepared.map(row=>row.material_name))].sort((a,b)=>a.localeCompare(b,"vi")),[prepared]);
 const filtered=useMemo(()=>prepared.filter(row=>(!deferredTerm||`${row.material_name} ${row.contractor_name} ${row.equipment_name} ${row.equipment_code}`.toLocaleLowerCase("vi").includes(deferredTerm))&&(!warranty||row.warranty_state===warranty)&&(!equipmentId||row.equipment_id===equipmentId)&&(!material||row.material_name===material)&&(!from||row.signed_on>=from)&&(!to||row.signed_on<=to)),[prepared,deferredTerm,warranty,equipmentId,material,from,to]);
 const counts=useMemo(()=>prepared.reduce((acc,row)=>{acc[row.warranty_state]++;return acc;},{active:0,due_soon:0,expired:0}),[prepared]);
 const pagination=paginate(filtered,page,pageSize),currentPage=pagination.page,visible=pagination.items;
 return <div className="contractor-materials space-y-5">
  <section className="panel contractor-intro"><div><p className="eyebrow">VẬT TƯ DO ĐƠN VỊ SỬA CHỮA CẤP</p><h1>Theo dõi vật tư nhà thầu</h1><p>Tách riêng khỏi phiếu lĩnh kho. Vật tư đã lắp lên phương tiện được xem là đạt; hệ thống tập trung theo dõi lịch sử lắp đặt và thời hạn bảo hành.</p></div><span className="plan-status">Nguồn mẫu VT_DVSC</span></section>
  <section className="stats-grid contractor-stats"><article className="stat-card"><strong>{prepared.length}</strong><p>Tổng số dòng</p></article><article className="stat-card contractor-stat-active"><strong>{counts.active}</strong><p>Còn hạn bảo hành</p></article><article className="stat-card contractor-stat-due"><strong>{counts.due_soon}</strong><p>Sắp tới hạn</p></article><article className="stat-card contractor-stat-expired"><strong>{counts.expired}</strong><p>Hết hạn bảo hành</p></article></section>
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
  <ContractorMaterialsImport workspace={workspace} equipment={equipment}/>
  <section className="panel"><div className="section-heading"><div><p className="eyebrow">KIỂM SOÁT THỜI HẠN BẢO HÀNH</p><h2>Danh sách vật tư nhà thầu</h2></div><div className="table-actions no-print"><span className="count-chip">{filtered.length} / {prepared.length} dòng</span><button type="button" className="button-secondary" onClick={()=>window.print()}>Xem trước / In danh sách</button></div></div>
   <div className="warranty-legend" aria-label="Quy ước màu bảo hành"><span className="contractor-badge contractor-active">Xanh · còn trên 30 ngày</span><span className="contractor-badge contractor-due_soon">Vàng · còn 0–30 ngày</span><span className="contractor-badge contractor-expired">Đỏ · đã hết hạn</span></div>
   <div className="contractor-filters contractor-filters-advanced"><label>Tìm kiếm<input value={term} onChange={event=>{setTerm(event.target.value);setPage(1);}} placeholder="Vật tư, nhà thầu, phương tiện…"/></label><label>Loại / tên vật tư<select value={material} onChange={event=>{setMaterial(event.target.value);setPage(1);}}><option value="">Tất cả vật tư</option>{materials.map(name=><option key={name}>{name}</option>)}</select></label><label>Phương tiện<select value={equipmentId} onChange={event=>{setEquipmentId(event.target.value);setPage(1);}}><option value="">Tất cả phương tiện</option>{equipment.map(item=><option key={item.id} value={item.id}>{equipmentLabel(item)}</option>)}</select></label><label>Ngày ký từ<input type="date" value={from} max={to||undefined} onChange={event=>{setFrom(event.target.value);setPage(1);}}/></label><label>Ngày ký đến<input type="date" value={to} min={from||undefined} onChange={event=>{setTo(event.target.value);setPage(1);}}/></label><label>Thời hạn bảo hành<select value={warranty} onChange={event=>{setWarranty(event.target.value as ""|WarrantyState);setPage(1);}}><option value="">Tất cả</option>{Object.entries(warrantyStateLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button type="button" className="button button-secondary" onClick={()=>{setTerm("");setWarranty("");setEquipmentId("");setMaterial("");setFrom("");setTo("");setPage(1);}}>Xóa bộ lọc</button></div>
   <div className="overflow-x-auto catalog-table-scroll"><table className="compact-table"><thead><tr><th>Vật tư</th><th>Phương tiện</th><th>Số lượng</th><th>Nhà thầu</th><th>Ngày ký</th><th>Hạn bảo hành</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead><tbody>{visible.map(row=><tr key={row.id} className={`contractor-alert-${row.warranty_state}`}><td className="single-line" title={row.material_name}><strong>{row.material_name}</strong></td><td><strong>{row.equipment_name}</strong><small>Mã gõ tắt: {row.equipment_code}</small></td><td>{formatNumber(row.quantity,3)} {row.unit}</td><td>{row.contractor_name||"Chưa ghi"}</td><td>{formatDateVi(row.signed_on)}</td><td>{formatDateVi(row.warranty_ends_on)}<small>{row.warranty_months} tháng</small></td><td><span className={`contractor-badge contractor-${row.warranty_state}`}>{warrantyStateLabels[row.warranty_state]}</span></td><td className="single-line" title={row.notes||""}>{row.notes||"—"}</td></tr>)}</tbody></table></div>
   <TablePagination page={currentPage} total={filtered.length} pageSize={pageSize} onChange={setPage}/>
   {!filtered.length&&<p>Không có dòng vật tư phù hợp bộ lọc.</p>}
  </section>
 </div>;
}

