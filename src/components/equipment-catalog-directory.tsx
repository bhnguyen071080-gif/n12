"use client";

import Link from "next/link";
import {useDeferredValue,useMemo,useState} from "react";
import {categoryLabels,equipmentCategories} from "@/lib/equipment-catalog";
import {statusLabels,type Equipment} from "@/lib/domain";
import {TablePagination} from "./table-pagination";
import {paginate} from "@/lib/pagination";

const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLocaleLowerCase("vi");

export function EquipmentCatalogDirectory({workspace,equipment,canEdit}:{workspace:string;equipment:Equipment[];canEdit:boolean}){
 const [name,setName]=useState(""),[code,setCode]=useState(""),[category,setCategory]=useState(""),[status,setStatus]=useState(""),[serial,setSerial]=useState(""),[year,setYear]=useState(""),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(25);
 const deferredName=useDeferredValue(name),deferredCode=useDeferredValue(code),deferredSerial=useDeferredValue(serial);
 const filtered=useMemo(()=>{
  const nameTerm=normalize(deferredName.trim()),codeTerm=normalize(deferredCode.trim()),serialTerm=normalize(deferredSerial.trim()),yearTerm=year.trim();
  return equipment.filter(item=>(!nameTerm||normalize(item.name).includes(nameTerm))&&(!codeTerm||normalize([item.code,...(item.source_codes??[])].join(" ")).includes(codeTerm))&&(!category||item.category===category)&&(!status||item.status===status)&&(!serialTerm||normalize(item.serial_number??"").includes(serialTerm))&&(!yearTerm||String(item.manufacture_year??"").includes(yearTerm)));
 },[equipment,deferredName,deferredCode,deferredSerial,category,status,year]);
 const pagination=paginate(filtered,page,pageSize),visible=pagination.items;
 const hasFilters=Boolean(name||code||category||status||serial||year);
 const reset=()=>{setName("");setCode("");setCategory("");setStatus("");setSerial("");setYear("");setPage(1);};
 const changePageSize=(size:number)=>{setPageSize(size);setPage(1);};
 return <section className="panel equipment-catalog-directory data-workbench-results" aria-labelledby="equipment-catalog-title">
  <div className="section-heading catalog-directory-heading"><h2 id="equipment-catalog-title">Danh sách phương tiện</h2><div className="catalog-directory-summary"><span>{filtered.length} / {equipment.length} phương tiện</span><button type="button" className="button-secondary" onClick={reset} disabled={!hasFilters}>Xóa lọc</button></div></div>
  {equipment.length?<>
   {visible.length?<div className="overflow-x-auto catalog-table-scroll data-workbench-table"><table className="compact-table equipment-catalog-table">
    <thead><tr><th>STT</th><th>Tên PTTB</th><th>Mã PTTB</th><th>Nhóm PTTB</th><th>Trạng thái</th><th>Số chế tạo</th><th>Năm sản xuất</th><th>Xem</th><th>Sửa</th></tr>
     <tr className="catalog-filter-row"><th><span className="sr-only">Bộ lọc</span></th><th><input aria-label="Lọc theo tên PTTB" value={name} onChange={event=>{setName(event.target.value);setPage(1);}} placeholder="Tìm kiếm…"/></th><th><input aria-label="Lọc theo mã PTTB" value={code} onChange={event=>{setCode(event.target.value);setPage(1);}} placeholder="Tìm kiếm…"/></th><th><select aria-label="Lọc theo nhóm PTTB" value={category} onChange={event=>{setCategory(event.target.value);setPage(1);}}><option value="">Tất cả</option>{equipmentCategories.map(value=><option key={value} value={value}>{categoryLabels[value]}</option>)}</select></th><th><select aria-label="Lọc theo trạng thái" value={status} onChange={event=>{setStatus(event.target.value);setPage(1);}}><option value="">Tất cả</option>{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></th><th><input aria-label="Lọc theo số chế tạo" value={serial} onChange={event=>{setSerial(event.target.value);setPage(1);}} placeholder="Tìm kiếm…"/></th><th><input aria-label="Lọc theo năm sản xuất" inputMode="numeric" value={year} onChange={event=>{setYear(event.target.value.replace(/\D/g,"").slice(0,4));setPage(1);}} placeholder="Năm"/></th><th/><th/></tr></thead>
    <tbody>{visible.map((item,index)=><tr key={item.id}><td>{(pagination.page-1)*pageSize+index+1}</td><th scope="row" className="equipment-name-cell" title={item.name}>{item.name}</th><td><code>{item.code}</code></td><td>{categoryLabels[item.category as keyof typeof categoryLabels]??"Chưa phân loại"}</td><td><span className={`status-badge status-${item.status}`}>{statusLabels[item.status]??"Chưa xác định"}</span></td><td>{item.serial_number??"—"}</td><td>{item.manufacture_year??"—"}</td><td><Link className="catalog-icon-action catalog-view-action" title={`Xem hồ sơ ${item.name}`} aria-label={`Xem hồ sơ ${item.name}`} href={`/equipment/${item.code}?workspace=${workspace}`}>↗</Link></td><td>{canEdit?<Link className="catalog-icon-action catalog-edit-action" title={`Sửa ${item.name}`} aria-label={`Sửa ${item.name}`} href={`/catalog?workspace=${workspace}&edit=${item.id}#them-phuong-tien`}>✎</Link>:<span aria-hidden="true">—</span>}</td></tr>)}</tbody>
   </table></div>:<div className="catalog-directory-empty"><strong>Không tìm thấy phương tiện phù hợp.</strong><button type="button" className="button button-secondary" onClick={reset}>Xóa bộ lọc</button></div>}
   <TablePagination page={pagination.page} total={filtered.length} pageSize={pageSize} onChange={setPage} onPageSizeChange={changePageSize}/>
  </>:<p className="muted">Danh mục còn trống. Hãy thêm phương tiện đầu tiên hoặc nhập từ tệp mẫu.</p>}
 </section>;
}

