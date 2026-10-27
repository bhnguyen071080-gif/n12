"use client";
import {useState} from "react";
import {formatNumber} from "@/lib/domain";
import {TablePagination} from "./table-pagination";
import {paginate} from "@/lib/pagination";

export type MonthlySavedRecord={
 id:string;
 equipmentCode:string;
 month:string;
 boxes?:number|null;
 cargoName?:string|null;
 quantity?:number|null;
 unit?:string|null;
};

export function MonthlySavedRecords({title,kind,rows,unitLabels}:{title:string;kind:"container"|"other";rows:MonthlySavedRecord[];unitLabels:Record<string,string>}){
 const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(25);
 const pagination=paginate(rows,page,pageSize);
 const changePageSize=(size:number)=>{setPageSize(size);setPage(1);};
 return <section className="panel data-workbench-results" aria-labelledby="monthly-saved-title">
  <div className="section-heading"><div><p className="eyebrow">DỮ LIỆU ĐÃ GHI</p><h2 id="monthly-saved-title">{title}</h2></div><span className="count-chip">{rows.length} dòng đã lưu</span></div>
  <div className="overflow-x-auto data-workbench-table"><table className="compact-table"><thead><tr><th>STT</th><th>Phương tiện</th><th>Tháng</th>{kind==="container"?<th>Container (chiếc)</th>:<><th>Loại hàng</th><th>Số lượng</th><th>Đơn vị</th></>}</tr></thead><tbody>{pagination.items.map((row,index)=><tr key={row.id}><td>{(pagination.page-1)*pageSize+index+1}</td><td><strong>{row.equipmentCode}</strong></td><td>{row.month.slice(0,7)}</td>{kind==="container"?<td>{formatNumber(row.boxes??null,0)}</td>:<><td>{row.cargoName}</td><td>{formatNumber(row.quantity??null,3)}</td><td>{unitLabels[row.unit??""]??row.unit??"—"}</td></>}</tr>)}</tbody></table></div>
  <TablePagination page={pagination.page} total={rows.length} pageSize={pageSize} onChange={setPage} onPageSizeChange={changePageSize}/>
  {!rows.length&&<p>Chưa có dữ liệu đã lưu.</p>}
 </section>;
}

