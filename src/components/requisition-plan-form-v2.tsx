"use client";

import {useMemo,useState} from "react";
import type {ActionResult} from "@/app/actions";
import {AsyncForm} from "./async-form";
import {
 buildVoucherPreviews,
 octoberMaintenancePlan,
 octoberPlanDocumentDay,
 planGroupLabels,
 formatPlannedDay,
 supplySourceLabels,
 type PlannedMaterial,
 type PlanGroup,
 type SupplySource,
 type VoucherPreview,
 type VoucherGrouping,
} from "@/lib/maintenance-requisition-plan";
import {chooseVoucherPrintLayout} from "@/lib/voucher-print-layout";
import {createEquipmentIdentityMatcher} from "@/lib/equipment-display";

const allGroups=Object.keys(planGroupLabels) as PlanGroup[];

type EquipmentOption={id:string;code:string;name:string;category:string};
type MaterialOption={id:string;code:string;name:string;unit:string};
type VoucherKind="planned"|"supplemental";

const materialSelectionKey=(equipmentCode:string,item:PlannedMaterial)=>`${equipmentCode}:${item.key}:${item.source}`;

function vietnameseDate(day:string){
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
 return match?`Ngày ${Number(match[3])} tháng ${Number(match[2])} năm ${match[1]}`:"Ngày ... tháng ... năm ...";
}

type VoucherDetail={id:string;documentNumber:string;documentDay:string};

function VoucherCopyPreview({voucher,lines,copy,page,pages,plannedDay,documentDay,documentNumber,kind,company,department,warehouse,compact}:{voucher:VoucherPreview;lines:PlannedMaterial[];copy:1|2;page:number;pages:number;plannedDay:string;documentDay:string;documentNumber:string;kind:VoucherKind;company:string;department:string;warehouse:string;compact:boolean}){
 const reason=kind==="supplemental"?"Bổ sung vật tư phát sinh khi bảo dưỡng":"Phục vụ bảo dưỡng theo kế hoạch";
 return <div className={compact?"voucher-copy voucher-copy-compact":"voucher-copy voucher-copy-a4"}>
  <div className="voucher-copy-meta">Liên {copy}/2{pages>1?` · Trang ${page}/${pages}`:""}</div>
  <div className="voucher-form-top"><strong>Đơn vị: {company}</strong><strong>BM.08.06</strong></div>
  <h4>PHIẾU LĨNH VẬT TƯ</h4>
  <p className="voucher-number">Số phiếu: {documentNumber||"........................"}</p>
  <p className="voucher-date">{vietnameseDate(documentDay)}</p>
  <p><strong>Tên đơn vị lĩnh:</strong> {department}</p>
  <p><strong>Lý do xuất kho:</strong> {reason} ({voucher.equipmentLabels.join(", ")})</p>
  <p><strong>Lĩnh tại kho:</strong> {warehouse}</p>
  <table><thead><tr><th rowSpan={2}>STT</th><th rowSpan={2}>Tên, nhãn hiệu, quy cách vật tư, dụng cụ</th><th rowSpan={2}>Danh điểm</th><th rowSpan={2}>Đơn vị tính</th><th colSpan={2}>Số lượng</th><th rowSpan={2}>Đơn giá</th><th rowSpan={2}>Thành tiền</th><th rowSpan={2}>Ghi chú</th></tr><tr><th>Xin lĩnh</th><th>Thực phát</th></tr></thead><tbody>{lines.map((line,lineIndex)=><tr key={`${line.equipmentCode??""}:${line.key}:${lineIndex}`}><td>{lineIndex+1}</td><td>{line.name}</td><td>{line.catalogueCode??""}</td><td>{line.unit}</td><td>{line.quantity.toLocaleString("vi-VN")}</td><td></td><td></td><td></td><td>{line.equipmentLabel??line.equipmentCode??""}</td></tr>)}<tr><td></td><td><strong>Cộng</strong></td><td colSpan={7}></td></tr></tbody></table>
  <p className="voucher-amount">Cộng thành tiền (viết bằng chữ): ...........................................................................................................</p>
  <div className="voucher-signatures">{["PHÒNG TCKT","THỦ KHO","NGƯỜI NHẬN","LÃNH ĐẠO PHÒNG"].map((title,index)=><div key={title}><strong>{title}</strong><span>{index===3?"(Ký, họ tên, đóng dấu)":"(Ký, ghi rõ họ tên)"}</span></div>)}</div>
  <p className="voucher-plan-source">Nguồn kế hoạch: {formatPlannedDay(plannedDay)}</p>
 </div>;
}

function VoucherLivePreview({voucher,index,kind,plannedDay,detail,onDetailChange,company,department,warehouse}:{voucher:VoucherPreview;index:number;kind:VoucherKind;plannedDay:string;detail:VoucherDetail;onDetailChange:(detail:VoucherDetail)=>void;company:string;department:string;warehouse:string}){
 const layout=chooseVoucherPrintLayout({lineLabels:voucher.lines.map(line=>[line.name,line.catalogueCode,line.equipmentLabel].filter(Boolean).join(" ")),equipmentLabels:voucher.equipmentLabels,contextText:voucher.scopeLabel});
 const chunks=layout.chunks.map(indexes=>indexes.map(lineIndex=>voucher.lines[lineIndex]));
 const capacityMessage=layout.format==="two-up-a5"
  ?`Đã ghép ${voucher.equipmentLabels.length} phương tiện vào một phiếu; hai liên vẫn vừa một tờ A4.`
  :layout.pagesPerCopy===1
   ?`Đã ghép ${voucher.equipmentLabels.length} phương tiện vào một phiếu; mỗi liên vừa một trang A4.`
   :`Phiếu đang vượt một trang A4 cho mỗi liên (${layout.pagesPerCopy} trang/liên). Hãy bỏ bớt phương tiện nếu muốn rút ngắn phiếu.`;
 return <article className="voucher-preview" data-print-format={layout.format}>
  <div className="voucher-preview-heading"><span>{kind==="supplemental"?"Phiếu bổ sung":"Phiếu kế hoạch"} {String(index+1).padStart(2,"0")}</span><strong>{layout.label}</strong><small>{voucher.lines.length} dòng vật tư · {voucher.equipmentLabels.length} phương tiện</small></div>
  <p className={layout.pagesPerCopy>1?"plan-warning":"plan-ok"} role="status">{capacityMessage}</p>
  <div className="voucher-meta-editor" aria-label={`Sửa thông tin phiếu ${index+1}`}>
   <label>Số phiếu<input value={detail.documentNumber} maxLength={100} placeholder="CTV/PLVT/2026_...." required onChange={event=>onDetailChange({...detail,documentNumber:event.target.value})}/></label>
   <label>Ngày phiếu (anh chọn)<input type="date" required value={detail.documentDay} onChange={event=>onDetailChange({...detail,documentDay:event.target.value})}/></label>
  </div>
  <p className="muted">Ngày kế hoạch lấy từ PDF: {formatPlannedDay(plannedDay)}. Số và ngày phiếu được lưu riêng cho phiếu này.</p>
  <div className="voucher-sheet-stack">
   {layout.format==="two-up-a5"?<div className="voucher-sheet voucher-sheet-two-up">
    <VoucherCopyPreview voucher={voucher} lines={voucher.lines} copy={1} page={1} pages={1} plannedDay={plannedDay} documentDay={detail.documentDay} documentNumber={detail.documentNumber} kind={kind} company={company} department={department} warehouse={warehouse} compact/>
    <VoucherCopyPreview voucher={voucher} lines={voucher.lines} copy={2} page={1} pages={1} plannedDay={plannedDay} documentDay={detail.documentDay} documentNumber={detail.documentNumber} kind={kind} company={company} department={department} warehouse={warehouse} compact/>
   </div>:[1,2].flatMap(copy=>chunks.map((lines,pageIndex)=><div className="voucher-sheet voucher-sheet-full" key={`${copy}:${pageIndex}`}>
    <VoucherCopyPreview voucher={voucher} lines={lines} copy={copy as 1|2} page={pageIndex+1} pages={chunks.length} plannedDay={plannedDay} documentDay={detail.documentDay} documentNumber={detail.documentNumber} kind={kind} company={company} department={department} warehouse={warehouse} compact={false}/>
   </div>))}
  </div>
 </article>;
}

export function RequisitionPlanForm({workspace,equipment,materials,today,completedEquipmentCodes,saveAction}:{workspace:string;workspaceName:string;equipment:EquipmentOption[];materials:MaterialOption[];today:string;completedEquipmentCodes:string[];saveAction:(data:FormData)=>Promise<ActionResult>}){
 const [groups,setGroups]=useState<PlanGroup[]>(allGroups);
 const [selectedEquipment,setSelectedEquipment]=useState<string[]>([]);
 // Người dùng tự quyết định thành phần phiếu bằng cách tích phương tiện.
 // Trong mỗi nguồn xuất chỉ có một phiếu đang soạn; không tự tách thành
 // nhiều phương án theo nhóm, họ vật tư hay từng phương tiện.
 const grouping:VoucherGrouping="date";
 const plannedDay=octoberPlanDocumentDay;
 const [voucherDetails,setVoucherDetails]=useState<Record<string,VoucherDetail>>({});
 const [company,setCompany]=useState("CHI NHÁNH CẢNG TÂN VŨ");
 const [department,setDepartment]=useState("BAN KỸ THUẬT");
 const [recipient,setRecipient]=useState("");
 const [warehouse,setWarehouse]=useState("Chi nhánh Cảng Tân Vũ");
 const [consumableWarehouse,setConsumableWarehouse]=useState("Chi nhánh Cảng Tân Vũ");
 const [voucherKind,setVoucherKind]=useState<VoucherKind>("planned");
 const [supplementNote,setSupplementNote]=useState("");
 const [supplementEquipment,setSupplementEquipment]=useState("");
 const [supplementMaterial,setSupplementMaterial]=useState("");
 const [supplementSource,setSupplementSource]=useState<SupplySource>("warehouse");
 const [supplementQuantity,setSupplementQuantity]=useState("1");
 const [supplementLines,setSupplementLines]=useState<PlannedMaterial[]>([]);
 const [selectedMaterials,setSelectedMaterials]=useState<string[]>(()=>octoberMaintenancePlan.flatMap(row=>row.materials.map(item=>materialSelectionKey(row.equipmentCode,item))));
 const [source,setSource]=useState<{name:string;sha256:string}|null>(null),[sourceError,setSourceError]=useState("");
 const [savedRun,setSavedRun]=useState("");
 const [saving,setSaving]=useState(false);
 const matchEquipment=useMemo(()=>createEquipmentIdentityMatcher(equipment),[equipment]);
 const completedSet=useMemo(()=>new Set(completedEquipmentCodes),[completedEquipmentCodes]);
 const selectablePlannedRows=useMemo(()=>octoberMaintenancePlan.filter(row=>{const match=matchEquipment(row.equipmentCode,row.sourceLabel);return !completedSet.has(row.equipmentCode)&&(!match||!completedSet.has(match.code));}),[completedSet,matchEquipment]);
 const selectedMaterialSet=useMemo(()=>new Set(selectedMaterials),[selectedMaterials]);
 const visiblePlanRows=useMemo(()=>selectablePlannedRows.filter(row=>groups.includes(row.group)&&selectedEquipment.includes(row.equipmentCode)),[selectablePlannedRows,groups,selectedEquipment]);
 const plannedRows=useMemo(()=>visiblePlanRows.map(row=>({...row,materials:row.materials.filter(item=>selectedMaterialSet.has(materialSelectionKey(row.equipmentCode,item)))})).filter(row=>row.materials.length>0),[visiblePlanRows,selectedMaterialSet]);
 const supplementBase=octoberMaintenancePlan.find(row=>row.equipmentCode===supplementEquipment);
 const rows=useMemo(()=>voucherKind==="planned"?plannedRows:supplementBase&&supplementLines.length?[{...supplementBase,materials:supplementLines}]:[],[voucherKind,plannedRows,supplementBase,supplementLines]);
 const resolvedRows=useMemo(()=>rows.map(row=>({row,match:matchEquipment(row.equipmentCode,row.sourceLabel)})),[rows,matchEquipment]);
 const previewRows=useMemo(()=>resolvedRows.map(({row,match})=>match?{...row,equipmentCode:match.code,equipmentName:match.name}:row),[resolvedRows]);
 const previewGroups=useMemo(()=>voucherKind==="planned"?groups:supplementBase?[supplementBase.group]:[],[voucherKind,groups,supplementBase]);
 const previews=useMemo(()=>buildVoucherPreviews(previewRows,previewGroups,grouping,plannedDay),[previewRows,previewGroups,plannedDay]);
 const currentVoucherDetails=useMemo(()=>previews.map(voucher=>voucherDetails[voucher.id]??{id:voucher.id,documentNumber:"",documentDay:today}),[previews,voucherDetails,today]);
 const voucherMetadataReady=currentVoucherDetails.every(detail=>detail.documentNumber.trim().length>0&&detail.documentDay.length===10);
 const unresolved=resolvedRows.filter(item=>!item.match).map(item=>item.row);
 const saveRows=resolvedRows.flatMap(({row,match})=>match?[{...row,equipmentId:match.id,equipmentCode:match.code,equipmentName:match.name}]:[]);

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
 }
 function toggleEquipment(code:string){setSelectedEquipment(current=>current.includes(code)?current.filter(value=>value!==code):[...current,code]);}
 function toggleMaterial(key:string){setSelectedMaterials(current=>current.includes(key)?current.filter(value=>value!==key):[...current,key]);}
 function updateVoucherDetail(detail:VoucherDetail){setVoucherDetails(current=>({...current,[detail.id]:detail}));}
 function setVisibleMaterials(enabled:boolean){
  const keys=new Set(visiblePlanRows.flatMap(row=>row.materials.map(item=>materialSelectionKey(row.equipmentCode,item))));
  setSelectedMaterials(current=>enabled?[...new Set([...current,...keys])]:current.filter(key=>!keys.has(key)));
 }

 function addSupplementLine(){
  const item=materials.find(material=>material.id===supplementMaterial),quantity=Number(supplementQuantity);
  if(!item||!Number.isFinite(quantity)||quantity<=0)return;
  const key=`catalog:${item.id}:${supplementSource}:${crypto.randomUUID()}`;
  setSupplementLines(current=>[...current,{key,name:item.name,unit:item.unit,quantity,source:supplementSource,catalogueCode:item.code}]);
  setSupplementQuantity("1");
 }

 const sourceCounts=previews.reduce<Record<SupplySource,number>>((result,voucher)=>{result[voucher.source]+=1;return result;},{warehouse:0,maintenance_consumable:0});
 return <fieldset disabled={saving||Boolean(savedRun)} className="requisition-plan space-y-5">
  <section className="panel requisition-plan-intro">
   <div><h1>Phiếu lĩnh vật tư bảo dưỡng</h1><p>Lập phiếu theo kế hoạch tháng hoặc bổ sung vật tư phát sinh trong quá trình thực hiện.</p></div>
  </section>

  <section className="panel">
   <h2>1. Liên kết tệp PDF và chọn phạm vi</h2>
   <p className="muted">Tệp PDF được liên kết bằng tên và mã kiểm tra. Danh sách bên dưới dùng nguồn kế hoạch tháng 10/2026 đã nhập sẵn; chưa tự trích xuất nội dung từ tệp.</p>
   <label>Tệp kế hoạch sửa chữa, bảo dưỡng tháng (.pdf)<input type="file" accept="application/pdf,.pdf" onChange={event=>void checkPdf(event.target.files?.[0])}/></label>
   {source?<p className="plan-ok" role="status">Đã chọn tệp: <strong>{source.name}</strong></p>:<p className="plan-warning" role="status">{sourceError||"Chọn đúng tệp PDF nguồn trước khi xác nhận nhập dữ liệu."}</p>}
   <div className="plan-live-controls">
    <div className="plan-form-grid">
     <label>Tháng kế hoạch<input type="month" value="2026-10" readOnly aria-describedby="plan-month-note"/></label>
     <label>Ngày văn bản kế hoạch (từ PDF)<input type="date" value={plannedDay} readOnly/></label>
    </div>
    <p id="plan-month-note" className="muted">Ngày 01/10/2026 lấy từ đầu văn bản PDF “Kế hoạch sửa chữa, bảo dưỡng tháng 10/2026” và không cho sửa tay. Ngày phiếu chỉ là ngày dự kiến ban đầu; anh có thể sửa riêng từng phiếu ở phần xem trước trước khi xác nhận.</p>
    {completedEquipmentCodes.length?<p className="plan-ok"><strong>{completedEquipmentCodes.length} phương tiện đã có phiếu kế hoạch trong tháng 10/2026</strong> và đã được ẩn khỏi danh sách lập phiếu mới. Phiếu bổ sung vẫn có thể chọn lại các phương tiện này.</p>:null}
    <fieldset className="plan-choice"><legend>Loại phiếu</legend>
     <label><input type="radio" name="voucher_kind" checked={voucherKind==="planned"} onChange={()=>setVoucherKind("planned")}/>Phiếu theo kế hoạch</label>
     <label><input type="radio" name="voucher_kind" checked={voucherKind==="supplemental"} onChange={()=>setVoucherKind("supplemental")}/>Phiếu bổ sung khi thực hiện</label>
    </fieldset>
    {voucherKind==="supplemental"?<div className="space-y-4">
     <p className="plan-warning"><strong>Chỉ nhập phần thiếu/phát sinh phát hiện khi làm thực tế.</strong> Phiếu này không thay thế và không lập lại toàn bộ vật tư trong kế hoạch ban đầu.</p>
     <label>Nội dung phát hiện khi thực hiện<input value={supplementNote} required maxLength={500} placeholder="Ví dụ: khi tháo kiểm tra phát hiện thiếu thêm 01 lọc dầu" onChange={event=>setSupplementNote(event.target.value)}/></label>
     <div className="plan-form-grid">
      <label>Phương tiện liên quan<select value={supplementEquipment} required onChange={event=>setSupplementEquipment(event.target.value)}><option value="">Chọn phương tiện trong kế hoạch</option>{octoberMaintenancePlan.flatMap(row=>{const match=matchEquipment(row.equipmentCode,row.sourceLabel);return match?[<option key={row.equipmentCode} value={row.equipmentCode}>{match.name} · {row.maintenanceLevel}</option>]:[];})}</select></label>
      <label>Vật tư chuẩn trong danh mục<select value={supplementMaterial} onChange={event=>setSupplementMaterial(event.target.value)}><option value="">Chọn vật tư</option>{materials.map(item=><option key={item.id} value={item.id}>{item.code} · {item.name} ({item.unit})</option>)}</select></label>
      <label>Nguồn lĩnh<select value={supplementSource} onChange={event=>setSupplementSource(event.target.value as SupplySource)}><option value="warehouse">Kho vật tư</option><option value="maintenance_consumable">Nguyên liệu, nhiên liệu bảo dưỡng</option></select></label>
      <label>Số lượng<input type="number" min="0.001" step="0.001" value={supplementQuantity} onChange={event=>setSupplementQuantity(event.target.value)}/></label>
     </div>
     <button type="button" className="button button-secondary" disabled={!supplementEquipment||!supplementMaterial||Number(supplementQuantity)<=0} onClick={addSupplementLine}>Thêm phần thiếu/phát sinh</button>
     {supplementLines.length?<div className="overflow-x-auto"><table><thead><tr><th>Vật tư thiếu/phát sinh</th><th>Nguồn</th><th>Số lượng bổ sung</th><th></th></tr></thead><tbody>{supplementLines.map(line=><tr key={line.key}><td>{line.catalogueCode} · {line.name}</td><td>{supplySourceLabels[line.source]}</td><td>{line.quantity.toLocaleString("vi-VN")} {line.unit}</td><td><button type="button" className="button button-secondary" onClick={()=>setSupplementLines(current=>current.filter(item=>item.key!==line.key))}>Bỏ</button></td></tr>)}</tbody></table></div>:<p className="muted">Chưa có dòng thiếu/phát sinh. Chỉ vật tư đã chuẩn hóa trong Danh mục vật tư mới được chọn.</p>}
    </div>:null}
    <p className="plan-ok"><strong>Cách ghép phiếu:</strong> khi anh tích thêm phương tiện, các dòng vật tư được nối ngay vào phiếu đang xem của cùng nguồn xuất. Hệ thống không tự tạo thêm phương án phiếu.</p>
    {voucherKind==="planned"?<fieldset className="plan-choice"><legend>Nhóm phương tiện</legend>
     {allGroups.map(group=><label key={group}><input type="checkbox" checked={groups.includes(group)} onChange={()=>toggleGroup(group)}/>{planGroupLabels[group]} <small>({selectablePlannedRows.filter(row=>row.group===group).length})</small></label>)}
    </fieldset>:null}
    {voucherKind==="planned"?<fieldset className="plan-choice plan-equipment-choice"><legend>Chọn phương tiện đưa vào phiếu</legend>
     <div className="plan-choice-actions"><button type="button" className="button button-secondary" onClick={()=>setSelectedEquipment(current=>[...new Set([...current,...selectablePlannedRows.filter(row=>groups.includes(row.group)).map(row=>row.equipmentCode)])])}>Chọn tất cả đang hiển thị</button><button type="button" className="button button-secondary" onClick={()=>{const visible=new Set(selectablePlannedRows.filter(row=>groups.includes(row.group)).map(row=>row.equipmentCode));setSelectedEquipment(current=>current.filter(code=>!visible.has(code)));}}>Bỏ chọn đang hiển thị</button></div>
     {selectablePlannedRows.filter(row=>groups.includes(row.group)).map(row=>{const match=matchEquipment(row.equipmentCode,row.sourceLabel);return <label key={row.equipmentCode}><input type="checkbox" checked={selectedEquipment.includes(row.equipmentCode)} onChange={()=>toggleEquipment(row.equipmentCode)}/>{match?.name??row.sourceLabel}</label>;})}
    </fieldset>:null}
    <div className="plan-source-note"><strong>Hệ thống luôn tách thành hai nguồn:</strong><span>Vật tư kho vật tư</span><span>Nguyên liệu, nhiên liệu bảo dưỡng</span></div>
    <p className="plan-ok plan-live-note" role="status">Bản xem trước bên dưới tự cập nhật ngay khi chọn phương tiện, vật tư, ngày hoặc cách gom phiếu.</p>
   </div>
  </section>

  <section className="plan-stats" aria-label="Tóm tắt phạm vi">
   <article className="panel"><span>Phương tiện</span><strong>{rows.length}</strong><small>dòng kế hoạch được chọn</small></article>
   <article className="panel"><span>Phiếu đang soạn</span><strong>{previews.length}</strong><small>tối đa một phiếu cho mỗi nguồn xuất; anh tự chọn hoặc bỏ phương tiện</small></article>
   <article className="panel"><span>Kho vật tư</span><strong>{sourceCounts.warehouse}</strong><small>phiếu lọc/phụ tùng</small></article>
   <article className="panel"><span>Nguyên–nhiên liệu</span><strong>{sourceCounts.maintenance_consumable}</strong><small>phiếu dầu, mỡ, nhiên liệu</small></article>
  </section>

  <section className="panel">
   <div className="section-heading"><div><h2>2. Chọn vật tư đưa lên phiếu</h2><p className="muted">Bỏ/chọn từng dòng; trang in mô phỏng cập nhật ngay.</p></div><div className="plan-choice-actions"><button type="button" className="button button-secondary" onClick={()=>setVisibleMaterials(true)}>Chọn tất cả vật tư</button><button type="button" className="button button-secondary" onClick={()=>setVisibleMaterials(false)}>Bỏ chọn vật tư</button><span className="count-chip">{rows.length} phương tiện</span></div></div>
   {unresolved.length?<p className="plan-warning" role="status"><strong>{unresolved.length} dòng chưa khớp mã danh mục:</strong> {unresolved.map(row=>row.sourceLabel).join(", ")}. Cần ghép đúng mã phương tiện trước khi xác nhận.</p>:<p className="plan-ok" role="status">Tất cả phương tiện đã khớp danh mục.</p>}
   <div className="overflow-x-auto"><table className="plan-table"><thead><tr><th>Nhóm</th><th>Phương tiện</th><th>Cấp bảo dưỡng</th><th>Vật tư kho</th><th>Nguyên liệu, nhiên liệu</th><th>Vụ việc</th></tr></thead><tbody>
    {visiblePlanRows.map(plan=>{
     const match=matchEquipment(plan.equipmentCode,plan.sourceLabel);
     const warehouse=plan.materials.filter(item=>item.source==="warehouse"),consumables=plan.materials.filter(item=>item.source==="maintenance_consumable");
     const materialToggle=(item:PlannedMaterial)=><label className="material-line material-toggle" key={item.key}><input type="checkbox" checked={selectedMaterialSet.has(materialSelectionKey(plan.equipmentCode,item))} onChange={()=>toggleMaterial(materialSelectionKey(plan.equipmentCode,item))}/><span>{item.catalogueCode?`${item.catalogueCode} · `:""}{item.name}: {item.quantity} {item.unit}</span></label>;
     return <tr key={`${plan.group}:${plan.equipmentCode}`}><td>{planGroupLabels[plan.group]}</td><td><strong>{match?.name??plan.sourceLabel}</strong><small className={match?"matched-code":"unmatched-code"}>{match?(match.name===match.code?`Đã ghép ${match.name}`:`Đã ghép theo tên/mã: ${match.name} · mã gõ tắt ${match.code}`):`Chưa ghép ${plan.sourceLabel}`}</small></td><td>{plan.maintenanceLevel}</td><td>{warehouse.length?warehouse.map(materialToggle):<span className="muted">Không phát sinh</span>}</td><td>{consumables.length?consumables.map(materialToggle):<span className="muted">Không phát sinh</span>}</td><td><code>Sinh khi lưu</code></td></tr>;
    })}
   </tbody></table></div>
  </section>

  <section className="panel" aria-live="polite">
   <div className="section-heading"><div><h2>3. Xem trước phiếu lĩnh</h2></div><span className="count-chip">{previews.length} phiếu</span></div>
   {!previews.length?<p className="plan-warning">Chưa có trang in. Hãy chọn ít nhất một phương tiện và một vật tư.</p>:null}
   {(["warehouse","maintenance_consumable"] as const).map(source=>{
    const sourceVouchers=previews.filter(voucher=>voucher.source===source);
    if(!sourceVouchers.length)return null;
    return <section className="voucher-source" key={source}><h3>{supplySourceLabels[source]} <span>{sourceVouchers.length} phiếu</span></h3><div className="voucher-preview-grid">
     {sourceVouchers.map(voucher=>{const globalIndex=previews.findIndex(item=>item.id===voucher.id),detail=currentVoucherDetails[globalIndex];return <VoucherLivePreview voucher={voucher} index={globalIndex} kind={voucherKind} plannedDay={plannedDay} detail={detail} onDetailChange={updateVoucherDetail} company={company} department={department} warehouse={voucher.source==="warehouse"?warehouse:consumableWarehouse} key={voucher.id}/>;})}
    </div></section>;
   })}
   <div className="plan-next-step"><strong>Kiểm soát trước khi nhập</strong><span>Chỉ các dòng đã khớp đúng phương tiện mới được xác nhận.</span></div>
   {!savedRun?<section className="plan-confirm"><h3>4. Xác nhận nhập dữ liệu và tạo vụ việc</h3>
    {(!source||!rows.length||!previews.length||unresolved.length>0||!voucherMetadataReady)?<p className="plan-warning">Chưa thể xác nhận: {!source?"chưa kiểm tra tệp PDF. ":""}{!rows.length||!previews.length?"chưa chọn đủ phương tiện và vật tư. ":""}{unresolved.length?"còn phương tiện chưa khớp danh mục. ":""}{previews.length&&!voucherMetadataReady?"cần nhập số phiếu và ngày cho từng phiếu.":""}</p>:<AsyncForm action={saveAction} label="Xác nhận bố cục, lưu & tạo vụ việc" onPendingChange={setSaving} onSuccess={result=>setSavedRun(result.id??"")}>
     <input type="hidden" name="workspace" value={workspace}/><input type="hidden" name="planned_day" value={plannedDay}/><input type="hidden" name="document_day" value={currentVoucherDetails[0]?.documentDay??today}/><input type="hidden" name="voucher_details" value={JSON.stringify(currentVoucherDetails)}/><input type="hidden" name="voucher_kind" value={voucherKind}/><input type="hidden" name="supplement_note" value={voucherKind==="supplemental"?supplementNote.trim():""}/><input type="hidden" name="grouping" value={grouping}/>
     <input type="hidden" name="rows" value={JSON.stringify(saveRows)}/><input type="hidden" name="source_filename" value={source?.name??""}/><input type="hidden" name="source_sha256" value={source?.sha256??""}/>
     <div className="plan-form-grid"><label>Đơn vị<input name="company" value={company} onChange={event=>setCompany(event.target.value)} required/></label><label>Tên đơn vị lĩnh<input name="department" value={department} onChange={event=>setDepartment(event.target.value)} required/></label><label>Người nhận<input name="recipient" value={recipient} onChange={event=>setRecipient(event.target.value)} placeholder="Có thể bổ sung khi in"/></label><label>Lĩnh tại kho vật tư<input name="warehouse" value={warehouse} onChange={event=>setWarehouse(event.target.value)}/></label><label>Lĩnh tại kho nguyên liệu, nhiên liệu<input name="consumable_warehouse" value={consumableWarehouse} onChange={event=>setConsumableWarehouse(event.target.value)}/></label></div>
     <p className="muted">Số phiếu và ngày phiếu được nhập tại từng bản xem trước phía trên; mỗi phiếu lưu độc lập để có thể sửa trước khi xác nhận.</p>
     <label><input type="checkbox" name="confirmed" required/> Tôi đã đối chiếu tệp nguồn, phương tiện và số lượng xin lĩnh.</label>
    </AsyncForm>}
   </section>:<p className="plan-ok"><strong>Đã nhập thành công.</strong> Mã lần nhập: <code>{savedRun}</code>. <a href={`/requisitions/${savedRun}`}>Mở kế hoạch đã lưu và in BM.08.06 →</a></p>}
  </section>
 </fieldset>;
}




