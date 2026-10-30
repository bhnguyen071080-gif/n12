"use client";

import Link from "next/link";
import {useState} from "react";

type Voucher={id:string;scopeLabel:string;sourceLabel:string;documentNumber:string;documentDay:string;equipmentLabels:string[];lines:{name:string;catalogueCode:string;unit:string;quantity:number;note:string}[];pdfHref:string};
type Allocation={equipmentId:string;sourceLabel:string;equipmentLabel:string;caseId:string;caseCode:string;materials:{key:string;name:string;quantity:number;unit:string}[]};

export function SavedRequisitionDetail({workspaceId,plannedDay,createdAt,vouchers,allocations,sourceFilename}:{workspaceId:string;plannedDay:string;createdAt:string;vouchers:Voucher[];allocations:Allocation[];sourceFilename:string|null}){
 const [tab,setTab]=useState<"materials"|"source"|"allocation">("materials");
 const displayDay=(value:string)=>value.split("-").reverse().join("/");
 return <div className="saved-requisition-screen">
  <header className="requisition-detail-title"><Link href={`/requisitions?workspace=${workspaceId}`}>← Danh sách phiếu lĩnh</Link><h1>Chi tiết phiếu lĩnh vật tư</h1></header>
  <section className="panel requisition-detail-summary">
   <div className="requisition-detail-actions">{vouchers.map((voucher,index)=><a className="button" key={voucher.id} href={voucher.pdfHref} target="_blank" rel="noreferrer">Mở / in phiếu {index+1}</a>)}</div>
   <dl><div><dt>Ngày kế hoạch</dt><dd>{displayDay(plannedDay)}</dd></div><div><dt>Ngày xác nhận</dt><dd>{new Date(createdAt).toLocaleString("vi-VN",{timeZone:"Asia/Bangkok"})}</dd></div><div><dt>Số phiếu</dt><dd>{vouchers.map(v=>v.documentNumber||"Chưa có số").join("; ")}</dd></div><div><dt>Trạng thái</dt><dd><span className="status-badge status-confirmed">Đã xác nhận</span></dd></div></dl>
  </section>
  <section className="panel requisition-detail-content">
   <div className="requisition-detail-tabs" role="tablist" aria-label="Nội dung phiếu lĩnh">
    <button type="button" role="tab" aria-selected={tab==="materials"} onClick={()=>setTab("materials")}>Danh sách vật tư</button>
    <button type="button" role="tab" aria-selected={tab==="allocation"} onClick={()=>setTab("allocation")}>Phân bổ phương tiện</button>
    <button type="button" role="tab" aria-selected={tab==="source"} onClick={()=>setTab("source")}>Hồ sơ nguồn</button>
   </div>
   {tab==="materials"&&<div role="tabpanel" className="requisition-tab-panel">{vouchers.map((voucher,voucherIndex)=><article key={voucher.id} className="requisition-voucher-block"><div className="section-heading"><div><h2>Phiếu {voucherIndex+1}: {voucher.scopeLabel}</h2><p>{voucher.sourceLabel} · {voucher.equipmentLabels.join(", ")}</p></div><a className="button button-secondary" href={voucher.pdfHref} target="_blank" rel="noreferrer">Xem bản in</a></div><div className="requisition-table-scroll"><table className="compact-table"><thead><tr><th>STT</th><th>Tên vật tư</th><th>Danh điểm</th><th>ĐVT</th><th>Số lượng xin lĩnh</th><th>Phương tiện</th></tr></thead><tbody>{voucher.lines.map((line,index)=><tr key={`${voucher.id}:${index}`}><td>{index+1}</td><td>{line.name}</td><td>{line.catalogueCode||"—"}</td><td>{line.unit}</td><td>{line.quantity.toLocaleString("vi-VN")}</td><td>{line.note||"—"}</td></tr>)}</tbody></table></div></article>)}</div>}
   {tab==="allocation"&&<div role="tabpanel" className="requisition-tab-panel"><div className="requisition-table-scroll"><table className="compact-table"><thead><tr><th>STT</th><th>Phương tiện nguồn</th><th>Phương tiện đã ghép</th><th>Vụ việc</th><th>Vật tư / số lượng</th></tr></thead><tbody>{allocations.map((row,index)=><tr key={row.equipmentId}><td>{index+1}</td><td>{row.sourceLabel}</td><td>{row.equipmentLabel}</td><td><Link href={`/cases/${row.caseId}`}>{row.caseCode}</Link></td><td>{row.materials.map(material=><div key={material.key}>{material.name}: {material.quantity} {material.unit}</div>)}</td></tr>)}</tbody></table></div></div>}
   {tab==="source"&&<div role="tabpanel" className="requisition-tab-panel requisition-source-card"><h2>Hồ sơ kế hoạch nguồn</h2><dl><div><dt>Tệp PDF đã dùng</dt><dd>{sourceFilename??"Bản ghi cũ chưa lưu tên tệp"}</dd></div><div><dt>Số phương tiện</dt><dd>{allocations.length}</dd></div><div><dt>Số phiếu được tạo</dt><dd>{vouchers.length}</dd></div></dl><p className="muted">Bản ghi đã xác nhận được khóa để bảo toàn dữ liệu và phục vụ đối soát.</p></div>}
  </section>
 </div>;
}
