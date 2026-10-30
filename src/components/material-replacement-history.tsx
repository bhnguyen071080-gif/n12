"use client";
import Link from "next/link";
import {useMemo,useState} from "react";
import {dayLabel} from "@/lib/monthly-hours";
import {formatNumber} from "@/lib/domain";
import {replacementStats,type MaterialReplacement} from "@/lib/material-replacements";
import {paginate} from "@/lib/pagination";
import {TablePagination} from "./table-pagination";

export function MaterialReplacementHistory({workspace,rows}:{workspace:string;rows:MaterialReplacement[]}){
 const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(25),stats=useMemo(()=>replacementStats(rows),[rows]);
 const pagination=paginate(rows,page,pageSize),visible=pagination.items;
 const changePageSize=(size:number)=>{setPageSize(size);setPage(1);};
 return <>
  <div className="replacement-stats" aria-label="Tổng hợp lịch sử thay thế">
   <article><span>Lượt thay trong kỳ</span><strong>{stats.total}</strong></article>
   <article><span>Phương tiện phát sinh</span><strong>{stats.equipment}</strong></article>
   <article><span>Loại vật tư đã thay</span><strong>{stats.materials}</strong></article>
   <article><span>Có lần thay trước</span><strong>{stats.repeated}</strong><small>{stats.averageDays===null?"Chưa đủ dữ liệu":"Bình quân "+stats.averageDays+" ngày"}</small></article>
  </div>
  <div className="overflow-x-auto catalog-table-scroll"><table className="compact-table replacement-table"><thead><tr><th>STT</th><th>Ngày thay</th><th>Phương tiện</th><th>Vật tư</th><th>Vị trí / cơ cấu</th><th>Số lượng</th><th>Lần thay trước</th><th>Căn cứ</th></tr></thead><tbody>{visible.map((row,index)=><tr key={row.usage_id}>
   <td>{(pagination.page-1)*pageSize+index+1}</td><td><strong>{dayLabel(row.replaced_on)}</strong></td>
   <td><Link href={`/equipment/${encodeURIComponent(row.equipment_code)}?workspace=${workspace}`}>{row.equipment_name}</Link><small>{row.equipment_code}</small></td>
   <th scope="row"><span className="single-line" title={row.material_name}>{row.material_name}</span><small>{row.material_code}</small></th>
   <td>{row.position||"Chưa ghi vị trí"}</td><td>{formatNumber(row.quantity,3)} {row.unit}</td>
   <td>{row.previous_replaced_on?<><strong>{dayLabel(row.previous_replaced_on)}</strong><small>{formatNumber(row.days_since_previous,0)} ngày</small></>:<span className="muted">Lần đầu ghi nhận</span>}</td>
   <td>{row.case_id?<Link href={`/cases/${row.case_id}`}>{row.case_code??row.order_code}</Link>:<Link href={`/equipment/${encodeURIComponent(row.equipment_code)}?workspace=${workspace}`}>{row.order_code}</Link>}</td>
  </tr>)}</tbody></table></div>
  <TablePagination page={pagination.page} total={rows.length} pageSize={pageSize} onChange={setPage} onPageSizeChange={changePageSize}/>
  {!rows.length&&<p className="muted">Không có lượt thay vật tư phù hợp. Dữ liệu chỉ xuất hiện khi vật tư trong vụ việc đã được đánh dấu “Đã thay”.</p>}
  {stats.total>rows.length&&<p className="plan-warning">Có {stats.total} lượt phù hợp; màn hình đang giới hạn {rows.length} lượt gần nhất. Hãy thu hẹp phương tiện, vật tư hoặc khoảng ngày.</p>}
 </>;
}

