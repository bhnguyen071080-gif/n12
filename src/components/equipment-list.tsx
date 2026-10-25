"use client";

import Link from "next/link";
import {useState} from "react";
import {statusLabels} from "@/lib/domain";
import {filterEquipment,type EquipmentCard} from "@/lib/equipment-display";
import {categoryLabels} from "@/lib/equipment-catalog";
import {Icon} from "./icons";

export function EquipmentList({equipment}:{equipment:EquipmentCard[]}){
 const [query,setQuery]=useState("");
 const [status,setStatus]=useState("");
 const visible=filterEquipment(equipment,query,status);
 return <section aria-labelledby="equipment-heading" className="equipment-section">
  <div className="section-heading">
   <div><p className="eyebrow">HỒ SƠ KỸ THUẬT</p><h2 id="equipment-heading">Danh mục phương tiện</h2></div>
   <span className="count-chip">{equipment.length} phương tiện</span>
  </div>
  {equipment.length>0?<>
   <div className="equipment-filters">
    <label className="search-field">Tìm phương tiện<div><Icon name="search"/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tên phương tiện hoặc mã gõ tắt"/></div></label>
    <label>Trạng thái<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
   </div>
   <p className="muted equipment-result-count" role="status">Hiển thị {visible.length} / {equipment.length} phương tiện</p>
   {visible.length?<div className="panel equipment-table-scroll">
    <table className="equipment-table">
     <thead><tr><th scope="col">STT</th><th scope="col">Tên phương tiện</th><th scope="col">Mã gõ tắt</th><th scope="col">Loại / nhóm</th><th scope="col">Số chế tạo</th><th scope="col">Năm SX</th><th scope="col">Giờ lũy kế</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead>
     <tbody>{visible.map((e,index)=><tr key={e.id}>
      <td>{index+1}</td>
      <th scope="row"><Link href={"/equipment/"+e.code+"?workspace="+e.workspace_id}>{e.name}</Link></th>
      <td>{e.code}</td>
      <td>{categoryLabels[e.category as keyof typeof categoryLabels]??e.category??"Chưa phân loại"}</td>
      <td>{e.serial_number??"—"}</td>
      <td>{e.manufacture_year??"—"}</td>
      <td>{e.accumulated_hours==null?"—":e.accumulated_hours.toLocaleString("vi-VN",{maximumFractionDigits:2})+" h"}</td>
      <td><span className={"status-badge status-"+e.status}>{statusLabels[e.status]??"Chưa xác định"}</span></td>
      <td><div className="equipment-table-actions">
       <Link href={"/equipment/"+e.code+"?workspace="+e.workspace_id}>Hồ sơ</Link>
       <Link href={"/monthly?workspace="+e.workspace_id+"&kind=hours&equipment="+e.id}>Giờ tháng</Link>
       <Link className="button button-secondary" href={"/equipment/"+e.code+"?workspace="+e.workspace_id+"&action=quick-inspect"}>Kiểm tra</Link>
      </div></td>
     </tr>)}</tbody>
    </table>
   </div>:<div className="panel empty-search">Không tìm thấy phương tiện. Hãy thử tên khác hoặc chọn tất cả trạng thái.</div>}
  </>:<div className="panel empty-catalog"><span className="empty-symbol"><Icon name="crane" width="48" height="48"/></span><div><h3>Sẵn sàng cho những phương tiện đầu tiên</h3><p>Chưa có thiết bị; cần nhập danh mục trước khi đồng bộ sản lượng.</p><p className="muted">Chuẩn bị mã phương tiện, tên và loại thiết bị. Sau khi nhập danh mục, hồ sơ và trạng thái sẽ xuất hiện tại đây.</p></div></div>}
 </section>;
}

