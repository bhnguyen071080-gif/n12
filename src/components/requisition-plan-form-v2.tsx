"use client";

import {useMemo,useState} from "react";
import {saveMaintenanceRequisition} from "@/app/requisitions/actions";
import {AsyncForm} from "./async-form";
import {
 buildVoucherPreviews,
 octoberMaintenancePlan,
 planGroupLabels,
 previewCaseCode,
 supplySourceLabels,
 type PlanGroup,
 type SupplySource,
 type VoucherGrouping,
} from "@/lib/maintenance-requisition-plan";

const allGroups=Object.keys(planGroupLabels) as PlanGroup[];

type EquipmentOption={id:string;code:string;name:string};
export function RequisitionPlanForm({workspace,workspaceName,equipment}:{workspace:string;workspaceName:string;equipment:EquipmentOption[]}){
 const [groups,setGroups]=useState<PlanGroup[]>(allGroups);
 const [grouping,setGrouping]=useState<VoucherGrouping>("group");
 const [plannedDay,setPlannedDay]=useState("2026-10-21");
 const [showPreview,setShowPreview]=useState(false);
 const [source,setSource]=useState<{name:string;sha256:string}|null>(null),[sourceError,setSourceError]=useState("");
 const [savedRun,setSavedRun]=useState("");
 const available=useMemo(()=>new Map(equipment.map(item=>[item.code,item])),[equipment]);
 const rows=useMemo(()=>octoberMaintenancePlan.filter(row=>groups.includes(row.group)),[groups]);
 const previews=useMemo(()=>buildVoucherPreviews(octoberMaintenancePlan,groups,grouping,plannedDay),[groups,grouping,plannedDay]);
 const unresolved=rows.filter(row=>!available.has(row.equipmentCode));
 const saveRows=rows.flatMap(row=>{const match=available.get(row.equipmentCode);return match?[{...row,equipmentId:match.id,equipmentName:match.name}]:[];});

 async function checkPdf(file?:File){
  setSource(null);setSourceError("");
  if(!file)return;
  if(file.type!=="application/pdf"&&!file.name.toLowerCase().endsWith(".pdf")){setSourceError("Chỉ nhận tệp PDF kế hoạch tháng.");return;}
  if(file.size<100||file.size>20*1024*1024){setSourceError("Tệp PDF phải từ 100 byte đến 20 MiB.");return;}
  const digest=await crypto.subtle.digest("SHA-256",await file.arrayBuffer());
  const sha256=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("");
  setSource({name:file.name,sha256});
 }

 function toggleGroup(group:PlanGroup){
  setGroups(current=>current.includes(group)?current.filter(value=>value!==group):[...current,group]);
  setShowPreview(false);
 }

 const sourceCounts=previews.reduce<Record<SupplySource,number>>((result,voucher)=>{result[voucher.source]+=1;return result;},{warehouse:0,maintenance_consumable:0});
 return <div className="requisition-plan space-y-5">
  <section className="panel requisition-plan-intro">
   <div><p className="eyebrow">VẬT TƯ, VẬT LIỆU PHỤC VỤ BẢO DƯỠNG</p><h1>Lập phiếu lĩnh từ kế hoạch bảo dưỡng tháng</h1><p>Không gian dữ liệu: <strong>{workspaceName}</strong>. Hệ thống kiểm tra tệp nguồn, đối chiếu mã và chỉ tạo vụ việc sau khi anh xác nhận nhập.</p></div>
   <span className="plan-status">Giẻ lau đã loại bỏ</span>
  </section>

  <section className="panel">
   <h2>1. Liên kết tệp PDF và chọn phạm vi</h2>
   <label>Tệp kế hoạch sửa chữa, bảo dưỡng tháng (.pdf)<input type="file" accept="application/pdf,.pdf" onChange={event=>void checkPdf(event.target.files?.[0])}/></label>
   {source?<p className="plan-ok" role="status">Đã kiểm tra tệp: <strong>{source.name}</strong> · mã kiểm soát {source.sha256.slice(0,12)}…</p>:<p className="plan-warning" role="status">{sourceError||"Chọn đúng tệp PDF nguồn trước khi xác nhận nhập dữ liệu."}</p>}
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
     {sourceVouchers.map((voucher,index)=><article className="voucher-preview" key={voucher.id}><header><span>Phiếu {String(index+1).padStart(2,"0")}</span><strong>{voucher.scopeLabel}</strong></header><p className="muted">Ngày dự kiến: {new Date(`${plannedDay}T00:00:00+07:00`).toLocaleDateString("vi-VN")}</p><p><strong>Phương tiện:</strong> {voucher.equipmentCodes.join(", ")}</p><table><thead><tr><th>Vật tư</th><th>Danh điểm</th><th>ĐVT</th><th>SL xin lĩnh</th></tr></thead><tbody>{voucher.lines.map(line=><tr key={line.key}><td>{line.name}</td><td>{line.catalogueCode??"—"}</td><td>{line.unit}</td><td>{line.quantity.toLocaleString("vi-VN")}</td></tr>)}</tbody></table></article>)}
    </div></section>;
   })}
   <div className="plan-next-step"><strong>Kiểm soát trước khi nhập</strong><span>Hệ thống chỉ lưu các dòng đã khớp phương tiện, kèm tên tệp và SHA-256 để nhận biết đúng bản PDF nguồn.</span></div>
   {!savedRun?<section className="plan-confirm"><h3>4. Xác nhận nhập dữ liệu và tạo vụ việc</h3>
    {(!source||unresolved.length>0)?<p className="plan-warning">Chưa thể xác nhận: {!source?"chưa kiểm tra tệp PDF. ":""}{unresolved.length?"còn phương tiện chưa khớp danh mục.":""}</p>:<AsyncForm action={saveMaintenanceRequisition} label="Xác nhận nhập dữ liệu & tạo vụ việc" onSuccess={result=>setSavedRun(result.id??"")}>
     <input type="hidden" name="workspace" value={workspace}/><input type="hidden" name="planned_day" value={plannedDay}/><input type="hidden" name="grouping" value={grouping}/>
     <input type="hidden" name="rows" value={JSON.stringify(saveRows)}/><input type="hidden" name="source_filename" value={source?.name??""}/><input type="hidden" name="source_sha256" value={source?.sha256??""}/>
     <div className="plan-form-grid"><label>Công ty<input name="company" defaultValue="CÔNG TY CỔ PHẦN CẢNG HẢI PHÒNG" required/></label><label>Đơn vị<input name="department" defaultValue="XÍ NGHIỆP XẾP DỠ TÂN VŨ" required/></label><label>Người nhận<input name="recipient" placeholder="Có thể bổ sung khi in"/></label><label>Kho vật tư<input name="warehouse" defaultValue="Kho vật tư"/></label><label>Kho nguyên liệu, nhiên liệu<input name="consumable_warehouse" defaultValue="Kho nguyên liệu, nhiên liệu"/></label><label>Ngày chứng từ<input type="date" name="document_day" value={plannedDay} readOnly/></label></div>
    </AsyncForm>}
   </section>:<p className="plan-ok"><strong>Đã nhập thành công.</strong> Mã lần nhập: <code>{savedRun}</code>. Mở danh sách vụ việc để kiểm tra và in BM.08.06.</p>}
  </section>:null}
 </div>;
}
