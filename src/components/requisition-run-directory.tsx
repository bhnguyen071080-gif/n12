"use client";

import Link from "next/link";
import {useMemo,useState} from "react";
import {TablePagination} from "./table-pagination";

export type RequisitionRunDirectoryRow={
 id:string;
 plannedDay:string;
 documentDay:string;
 voucherKind:"planned"|"supplemental";
 supplementNote:string|null;
 groupingMode:"equipment"|"group"|"date";
 createdAt:string;
 sourceFilename:string|null;
 documentNumbers:string[];
 voucherCount:number;
 equipmentCount:number;
};

const kindLabel={planned:"Theo kế hoạch",supplemental:"Bổ sung"} as const;
const groupingLabel={equipment:"Theo phương tiện",group:"Theo nhóm",date:"Theo ngày"} as const;
const displayDay=(value:string)=>value?value.split("-").reverse().join("/"):"—";
const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").toLowerCase();

export function RequisitionRunDirectory({rows,newHref}:{rows:RequisitionRunDirectoryRow[];newHref:string}){
 const [query,setQuery]=useState(""),[kind,setKind]=useState(""),[from,setFrom]=useState(""),[to,setTo]=useState("");
 const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(25);
 const filtered=useMemo(()=>rows.filter(row=>{
  const haystack=normalize([row.documentNumbers.join(" "),row.sourceFilename,row.supplementNote,kindLabel[row.voucherKind],groupingLabel[row.groupingMode]].filter(Boolean).join(" "));
  return (!query.trim()||haystack.includes(normalize(query.trim())))&&(!kind||row.voucherKind===kind)&&(!from||row.documentDay>=from)&&(!to||row.documentDay<=to);
 }),[rows,query,kind,from,to]);
 const pages=Math.max(1,Math.ceil(filtered.length/pageSize)),safePage=Math.min(page,pages),visible=filtered.slice((safePage-1)*pageSize,safePage*pageSize);
 const reset=()=>{setQuery("");setKind("");setFrom("");setTo("");setPage(1);};
 return <section className="panel requisition-directory">
  <div className="requisition-directory-actions">
   <Link className="button" href={newHref}>Thêm mới</Link>
   <span className="requisition-lock-note">Phiếu đã xác nhận được khóa để bảo toàn số liệu.</span>
  </div>
  <div className="requisition-directory-filters" role="search">
   <label>Tìm kiếm<input value={query} onChange={event=>{setQuery(event.target.value);setPage(1);}} placeholder="Số phiếu, tệp nguồn, nội dung…"/></label>
   <label>Từ ngày<input type="date" value={from} onChange={event=>{setFrom(event.target.value);setPage(1);}}/></label>
   <label>Đến ngày<input type="date" value={to} onChange={event=>{setTo(event.target.value);setPage(1);}}/></label>
   <label>Loại phiếu<select value={kind} onChange={event=>{setKind(event.target.value);setPage(1);}}><option value="">Tất cả</option><option value="planned">Theo kế hoạch</option><option value="supplemental">Bổ sung</option></select></label>
   <button className="button-secondary" type="button" onClick={reset}>Xóa bộ lọc</button>
  </div>
  <div className="requisition-table-scroll">
   <table className="compact-table requisition-table"><thead><tr><th>STT</th><th>Số phiếu</th><th>Loại phiếu</th><th>Ngày kế hoạch</th><th>Ngày lập phiếu</th><th>Cách gom</th><th>Phương tiện</th><th>Tệp PDF nguồn</th><th>Trạng thái</th><th>Chi tiết</th></tr></thead>
    <tbody>{visible.map((row,index)=><tr key={row.id}>
     <td>{(safePage-1)*pageSize+index+1}</td><td className="requisition-number-cell">{row.documentNumbers.length?row.documentNumbers.map(number=><span key={number}>{number}</span>):"Chưa có số"}</td><td>{kindLabel[row.voucherKind]}</td><td>{displayDay(row.plannedDay)}</td><td>{displayDay(row.documentDay)}</td><td>{groupingLabel[row.groupingMode]}</td><td>{row.equipmentCount}</td><td title={row.sourceFilename??undefined}>{row.sourceFilename??"Bản cũ"}</td><td><span className="status-badge status-confirmed">Đã xác nhận</span></td><td><Link className="table-icon-action" href={`/requisitions/${row.id}`} aria-label="Xem chi tiết và in phiếu" title="Xem chi tiết / In">Xem / In</Link></td>
    </tr>)}</tbody></table>
  </div>
  {!visible.length&&<p className="requisition-empty">Không có phiếu phù hợp bộ lọc.</p>}
  <TablePagination page={safePage} total={filtered.length} pageSize={pageSize} onChange={setPage} onPageSizeChange={size=>{setPageSize(size);setPage(1);}}/>
 </section>;
}
