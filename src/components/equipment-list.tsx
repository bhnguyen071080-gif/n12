"use client";
import Link from "next/link";
import {useState} from "react";
import {statusLabels} from "@/lib/domain";
import {filterEquipment,type EquipmentCard} from "@/lib/equipment-display";
import {Icon} from "./icons";

export function EquipmentList({equipment}:{equipment:EquipmentCard[]}){
 const [query,setQuery]=useState(""),[status,setStatus]=useState("");
 const visible=filterEquipment(equipment,query,status);
 return <section aria-labelledby="equipment-heading" className="equipment-section">
  <div className="section-heading"><div><p className="eyebrow">HỒ SƠ KỸ THUẬT</p><h2 id="equipment-heading">Danh mục phương tiện</h2></div><span className="count-chip">{equipment.length} phương tiện</span></div>
  {equipment.length>0?<><div className="equipment-filters"><label className="search-field">Tìm phương tiện<div><Icon name="search"/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Mã hoặc tên phương tiện"/></div></label><label>Trạng thái<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></div>
   <p className="muted" role="status">Hiển thị {visible.length} / {equipment.length} phương tiện</p><div className="equipment-grid">{visible.map(e=><article className="panel equipment-card" key={e.id}><div className="equipment-card-top"><span className="equipment-symbol"><Icon name="crane" width="30" height="30"/></span><span className={"status-badge status-"+e.status}>{statusLabels[e.status]??"Chưa xác định trạng thái"}</span></div><h3><Link href={"/equipment/"+e.code+"?workspace="+e.workspace_id}>{e.code}</Link></h3><p className="equipment-name">{e.name}</p><Link className="hours-link" href={"/monthly?workspace="+e.workspace_id+"&kind=hours&equipment="+e.id}><Icon name="clock"/>Giờ hoạt động tháng</Link><Link className="button equipment-action" href={"/equipment/"+e.code+"?workspace="+e.workspace_id+"&action=quick-inspect"}>Kiểm tra / báo hỏng<Icon name="arrow"/></Link></article>)}</div>{!visible.length && <div className="panel empty-search">Không tìm thấy phương tiện. Hãy thử tên khác hoặc chọn tất cả trạng thái.</div>}</>:<div className="panel empty-catalog"><span className="empty-symbol"><Icon name="crane" width="48" height="48"/></span><div><h3>Sẵn sàng cho những phương tiện đầu tiên</h3><p>Chưa có thiết bị; cần nhập danh mục trước khi đồng bộ sản lượng.</p><p className="muted">Chuẩn bị mã phương tiện, tên và loại thiết bị. Sau khi nhập danh mục, hồ sơ và trạng thái sẽ xuất hiện tại đây.</p></div></div>}
 </section>;
}
