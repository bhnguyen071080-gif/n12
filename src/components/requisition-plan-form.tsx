"use client";

import {useMemo,useState} from "react";
import {
 buildVoucherPreviews,
 formatPlannedDay,
 octoberMaintenancePlan,
 planGroupLabels,
 previewCaseCode,
 supplySourceLabels,
 type PlanGroup,
 type SupplySource,
 type VoucherGrouping,
} from "@/lib/maintenance-requisition-plan";

const allGroups=Object.keys(planGroupLabels) as PlanGroup[];

export function RequisitionPlanForm({workspaceName,equipmentCodes}:{workspaceName:string;equipmentCodes:string[]}){
 const [groups,setGroups]=useState<PlanGroup[]>(allGroups);
 const [grouping,setGrouping]=useState<VoucherGrouping>("group");
 const [plannedDay,setPlannedDay]=useState("2026-10-21");
 const [showPreview,setShowPreview]=useState(false);
 const available=useMemo(()=>new Set(equipmentCodes),[equipmentCodes]);
 const rows=useMemo(()=>octoberMaintenancePlan.filter(row=>groups.includes(row.group)),[groups]);
 const previews=useMemo(()=>buildVoucherPreviews(octoberMaintenancePlan,groups,grouping,plannedDay),[groups,grouping,plannedDay]);
 const unresolved=rows.filter(row=>!available.has(row.equipmentCode));

 function toggleGroup(group:PlanGroup){
  setGroups(current=>current.includes(group)?current.filter(value=>value!==group):[...current,group]);
  setShowPreview(false);
 }

 const sourceCounts=previews.reduce<Record<SupplySource,number>>((result,voucher)=>{result[voucher.source]+=1;return result;},{warehouse:0,maintenance_consumable:0});
 return <div className="requisition-plan space-y-5">
  <section className="panel requisition-plan-intro">
   <div><p className="eyebrow">Chạy thử · chưa ghi dữ liệu</p><h1>Lập phiếu lĩnh từ kế hoạch bảo dưỡng tháng</h1><p>Không gian dữ liệu: <strong>{workspaceName}</strong>. Form dùng dữ liệu kế hoạch tháng 10/2026 để anh kiểm tra cách tách phiếu trước khi bật chức năng lưu.</p></div>
   <span className="plan-status">Giẻ lau đã loại bỏ</span>
  </section>

  <section className="panel">
   <h2>1. Chọn phạm vi lập phiếu</h2>
   <form onSubmit={event=>{event.preventDefault();setShowPreview(true);}}>
    <div className="plan-form-grid">
     <label>Tháng kế hoạch<input type="month" value="2026-10" readOnly aria-describedby="plan-month-note"/></label>
     <label>Ngày dự kiến thực hiện<input type="date" required value={plannedDay} min="2026-10-01" max="2026-10-31" onChange={event=>{setPlannedDay(event.target.value);setShowPreview(false);}}/></label>
    </div>
    <p id="plan-month-note" className="muted">Ngày này dùng để xem trước mã vụ việc. Mã chính thức vẫn do cơ sở dữ liệu sinh khi lưu.</p>
    <fieldset className="plan-choice"><legend>Cách gom phiếu</legend>
     <label><input type="radio" name="grouping" checked={grouping==="group"} onChange={()=>{setGrouping("group");setShowPreview(false);}}/>Theo nhóm phương tiện</label>
     <label><input type="radio" name="grouping" checked={grouping==="equipment"} onChange={()=>{setGrouping("equipment");setShowPreview(false);}}/>Theo từng phương tiện</label>
    <label><input type="radio" name="grouping" checked={grouping==="date"} onChange={()=>{setGrouping("date");setShowPreview(false);}}/>Theo ngày cùng thực hiện</label>
    </fieldset>
    <fieldset className="plan-choice"><legend>Nhóm phương tiện</legend>
     {allGroups.map(group=><label key={group}><input type="checkbox" checked={groups.includes(group)} onChange={()=>toggleGroup(group)}/>{planGroupLabels[group]} <small>({octoberMaintenancePlan.filter(row=>row.group===group).length})</small></label>)}
    </fieldset>
    <div className="plan-source-note"><strong>Hệ thống luôn tách thành hai nguồn:</strong><span>Vật tư kho vật tư</span><span>Nguyên liệu, nhiên liệu bảo dưỡng</span></div>
    <button type="submit" disabled={!groups.length||!plannedDay}>Tính và xem trước phiếu</button>
   </form>
  </section>

  <section className="plan-stats" aria-label="Tóm tắt phạm vi">
   <article className="panel"><span>Phương tiện</span><strong>{rows.length}</strong><small>dòng kế hoạch được chọn</small></article>
   <article className="panel"><span>Phiếu dự kiến</span><strong>{previews.length}</strong><small>{grouping==="group"?"gom theo nhóm, ngày và nguồn":grouping==="date"?"gom các phương tiện cùng ngày và nguồn":"tách theo phương tiện, ngày và nguồn"}</small></article>
   <article className="panel"><span>Kho vật tư</span><strong>{sourceCounts.warehouse}</strong><small>phiếu lọc/phụ tùng</small></article>
   <article className="panel"><span>Nguyên–nhiên liệu</span><strong>{sourceCounts.maintenance_consumable}</strong><small>phiếu dầu, mỡ, nhiên liệu</small></article>
  </section>

  <section className="panel">
   <div className="section-heading"><div><p className="eyebrow">Đối chiếu nguồn</p><h2>2. Dòng kế hoạch sẽ sử dụng</h2></div><span className="count-chip">{rows.length} phương tiện</span></div>
   {unresolved.length?<p className="plan-warning" role="status"><strong>{unresolved.length} dòng chưa khớp mã danh mục:</strong> {unresolved.map(row=>row.sourceLabel).join(", ")}. Bản chạy thử vẫn cho xem trước; khi bật lưu phải ghép đúng mã trước.</p>:<p className="plan-ok" role="status">Tất cả phương tiện đã khớp danh mục TV‑EAM.</p>}
   <div className="overflow-x-auto"><table className="plan-table"><thead><tr><th>Nhóm</th><th>Phương tiện</th><th>Cấp bảo dưỡng</th><th>Vật tư kho</th><th>Nguyên liệu, nhiên liệu</th><th>Mã vụ việc dự kiến</th></tr></thead><tbody>
    {rows.map(plan=>{
     const warehouse=plan.materials.filter(item=>item.source==="warehouse"),consumables=plan.materials.filter(item=>item.source==="maintenance_consumable");
     return <tr key={`${plan.group}:${plan.equipmentCode}`}><td>{planGroupLabels[plan.group]}</td><td><strong>{plan.sourceLabel}</strong><small className={available.has(plan.equipmentCode)?"matched-code":"unmatched-code"}>{available.has(plan.equipmentCode)?`Đã khớp ${plan.equipmentCode}`:`Chưa khớp ${plan.equipmentCode}`}</small></td><td>{plan.maintenanceLevel}</td><td>{warehouse.length?warehouse.map(item=><span className="material-line" key={item.key}>{item.catalogueCode?`${item.catalogueCode} · `:""}{item.name}: {item.quantity} {item.unit}</span>):<span className="muted">Không phát sinh</span>}</td><td>{consumables.map(item=><span className="material-line" key={item.key}>{item.name}: {item.quantity} {item.unit}</span>)}</td><td><code>{previewCaseCode(plan.equipmentCode,plannedDay)}</code></td></tr>;
    })}
   </tbody></table></div>
  </section>

  {showPreview?<section className="panel" aria-live="polite">
   <div className="section-heading"><div><p className="eyebrow">Kết quả chạy thử</p><h2>3. Các phiếu sẽ được sinh</h2></div><span className="count-chip">{previews.length} phiếu</span></div>
   <p className="plan-ok">Đã tách nguồn và cộng lại từ từng phương tiện. Không có dòng giẻ lau trong kết quả.</p>
   {(["warehouse","maintenance_consumable"] as const).map(source=>{
    const sourceVouchers=previews.filter(voucher=>voucher.source===source);
    if(!sourceVouchers.length)return null;
    return <section className="voucher-source" key={source}><h3>{supplySourceLabels[source]} <span>{sourceVouchers.length} phiếu</span></h3><div className="voucher-preview-grid">
     {sourceVouchers.map((voucher,index)=><article className="voucher-preview" key={voucher.id}><header><span>Phiếu {String(index+1).padStart(2,"0")}</span><strong>{voucher.scopeLabel}</strong></header><p className="muted">Ngày dự kiến: {formatPlannedDay(plannedDay)}</p><p><strong>Phương tiện:</strong> {voucher.equipmentLabels.join(", ")}</p><table><thead><tr><th>Vật tư</th><th>Danh điểm</th><th>ĐVT</th><th>SL xin lĩnh</th></tr></thead><tbody>{voucher.lines.map(line=><tr key={line.key}><td>{line.name}</td><td>{line.catalogueCode??"—"}</td><td>{line.unit}</td><td>{line.quantity.toLocaleString("vi-VN")}</td></tr>)}</tbody></table></article>)}
    </div></section>;
   })}
   <div className="plan-next-step"><strong>Bản chạy thử chỉ xem trước.</strong><span>Bước tiếp theo sẽ lưu phiên bản kế hoạch, tạo mã vụ việc thật và chuyển từng phiếu sang mẫu BM.08.06 để in.</span></div>
  </section>:null}
 </div>;
}

