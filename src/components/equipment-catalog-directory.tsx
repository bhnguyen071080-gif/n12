"use client";

import Link from "next/link";
import {useDeferredValue,useMemo,useState} from "react";
import {categoryLabels,equipmentCategories} from "@/lib/equipment-catalog";
import {statusLabels,type Equipment} from "@/lib/domain";
import {TablePagination} from "./table-pagination";
import {paginate} from "@/lib/pagination";

const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLocaleLowerCase("vi");

export function EquipmentCatalogDirectory({workspace,equipment,canEdit}:{workspace:string;equipment:Equipment[];canEdit:boolean}){
 const [query,setQuery]=useState(""),[category,setCategory]=useState(""),[status,setStatus]=useState(""),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(25);
 const deferredQuery=useDeferredValue(query);
 const filtered=useMemo(()=>{
  const term=normalize(deferredQuery.trim());
  return equipment.filter(item=>(!term||normalize([item.name,item.code,item.serial_number??"",...(item.source_codes??[])].join(" ")).includes(term))&&(!category||item.category===category)&&(!status||item.status===status));
 },[equipment,deferredQuery,category,status]);
 const pagination=paginate(filtered,page,pageSize),visible=pagination.items;
 const reset=()=>{setQuery("");setCategory("");setStatus("");setPage(1);};
 const changePageSize=(size:number)=>{setPageSize(size);setPage(1);};
 return <section className="panel equipment-catalog-directory data-workbench-results" aria-labelledby="equipment-catalog-title">
  <div className="section-heading catalog-directory-heading"><div><h2 id="equipment-catalog-title">Phương tiện đang quản lý</h2><p className="muted">Tên đầy đủ là thông tin hiển thị chính; mã chỉ dùng để gõ tắt và đối chiếu dữ liệu.</p></div><span className="count-chip">{equipment.length} phương tiện</span></div>
  {equipment.length?<>
   <div className="catalog-directory-filters">
    <label className="catalog-directory-search">Tìm nhanh<input type="search" value={query} onChange={event=>{setQuery(event.target.value);setPage(1);}} placeholder="Tên, mã gõ tắt, số chế tạo…"/></label>
    <label>Nhóm phương tiện<select value={category} onChange={event=>{setCategory(event.target.value);setPage(1);}}><option value="">Tất cả nhóm</option>{equipmentCategories.map(value=><option key={value} value={value}>{categoryLabels[value]}</option>)}</select></label>
    <label>Trạng thái<select value={status} onChange={event=>{setStatus(event.target.value);setPage(1);}}><option value="">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <button type="button" className="button button-secondary catalog-reset" onClick={reset} disabled={!query&&!category&&!status}>Xóa bộ lọc</button>
   </div>
   <p className="muted equipment-result-count" role="status">Hiển thị {filtered.length} / {equipment.length} phương tiện</p>
   {visible.length?<div className="overflow-x-auto catalog-table-scroll data-workbench-table"><table className="compact-table equipment-catalog-table">
    <thead><tr><th>STT</th><th>Tên phương tiện</th><th>Mã gõ tắt</th><th>Nhóm phương tiện</th><th>Số chế tạo</th><th>Năm SX</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
    <tbody>{visible.map((item,index)=><tr key={item.id}><td>{(pagination.page-1)*pageSize+index+1}</td><th scope="row" className="equipment-name-cell" title={item.name}>{item.name}</th><td><code>{item.code}</code></td><td>{categoryLabels[item.category as keyof typeof categoryLabels]??"Chưa phân loại"}</td><td>{item.serial_number??"—"}</td><td>{item.manufacture_year??"—"}</td><td><span className={`status-badge status-${item.status}`}>{statusLabels[item.status]??"Chưa xác định"}</span></td><td><div className="catalog-row-actions">
     <Link className="button button-secondary table-action" href={`/equipment/${item.code}?workspace=${workspace}`}>Xem hồ sơ</Link>
     <Link className="button button-secondary table-action" href={`/monthly?workspace=${workspace}&kind=hours&equipment=${item.id}`}>Giờ hoạt động</Link>
     {canEdit&&<Link className="button table-action" href={`/catalog?workspace=${workspace}&edit=${item.id}#them-phuong-tien`}>Chỉnh sửa</Link>}
    </div></td></tr>)}</tbody>
   </table></div>:<div className="catalog-directory-empty"><strong>Không tìm thấy phương tiện phù hợp.</strong><button type="button" className="button button-secondary" onClick={reset}>Xóa bộ lọc</button></div>}
   <TablePagination page={pagination.page} total={filtered.length} pageSize={pageSize} onChange={setPage} onPageSizeChange={changePageSize}/>
  </>:<p className="muted">Danh mục còn trống. Hãy thêm phương tiện đầu tiên hoặc nhập từ tệp mẫu.</p>}
 </section>;
}

