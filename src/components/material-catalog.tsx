"use client";
import Link from "next/link";
import {useDeferredValue,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {saveMaterial} from "@/app/materials/actions";
import {materialCategoryLabels,materialDuplicateGroups,normalizeMaterialIdentity,type MaterialCatalogRow} from "@/lib/material-catalog";
import {formatNumber} from "@/lib/domain";
import {TableImporter} from "./table-importer";
import {AsyncForm} from "./async-form";
import {TablePagination} from "./table-pagination";
import {paginate} from "@/lib/pagination";
export function MaterialCatalog({workspace,rows,canEdit,openImport=false}:{workspace:string;rows:MaterialCatalogRow[];canEdit:boolean;openImport?:boolean}){
 const router=useRouter(),[edited,setEdited]=useState<MaterialCatalogRow>(),[name,setName]=useState(""),[code,setCode]=useState(""),[unit,setUnit]=useState(""),[category,setCategory]=useState(""),[limit,setLimit]=useState(""),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(25);
 const deferredName=useDeferredValue(name),deferredCode=useDeferredValue(code),deferredUnit=useDeferredValue(unit);
 const duplicates=useMemo(()=>materialDuplicateGroups(rows),[rows]),duplicateIds=useMemo(()=>new Set(duplicates.flatMap(group=>group.map(row=>row.id))),[duplicates]);
 const found=useMemo(()=>{
  const nameTerm=normalizeMaterialIdentity(deferredName),codeTerm=normalizeMaterialIdentity(deferredCode),unitTerm=normalizeMaterialIdentity(deferredUnit);
  return rows.filter(row=>(!nameTerm||normalizeMaterialIdentity(row.name).includes(nameTerm))&&(!codeTerm||normalizeMaterialIdentity(row.code).includes(codeTerm))&&(!unitTerm||normalizeMaterialIdentity(row.unit).includes(unitTerm))&&(!category||(category==="unknown"?!row.equipment_category:row.equipment_category===category))&&(!limit||(limit==="with"?row.service_limit_hours!==null:row.service_limit_hours===null))).sort((a,b)=>a.name.localeCompare(b.name,"vi",{numeric:true}));
 },[rows,deferredName,deferredCode,deferredUnit,category,limit]);
 const pagination=paginate(found,page,pageSize),currentPage=pagination.page,visible=pagination.items;
 const expected=edited?{id:edited.id,name:edited.name,unit:edited.unit,equipment_category:edited.equipment_category}:null;
 const hasFilters=Boolean(name||code||unit||category||limit);
 const resetFilters=()=>{setName("");setCode("");setUnit("");setCategory("");setLimit("");setPage(1);};
 const changePageSize=(size:number)=>{setPageSize(size);setPage(1);};
 return <div className="material-catalog-shell">
  <div className="material-catalog data-workbench material-catalog-workbench">
   <div className="data-workbench-entry" id="material-editor">
   {canEdit?<section className="panel material-editor">
    <AsyncForm key={edited?JSON.stringify(expected):"new"} action={saveMaterial} showDefaultSubmit={false} resetLabel={edited?"Tiếp tục chỉnh sửa":"Thêm vật tư khác"} resetOnNew={!edited} onSuccess={()=>router.refresh()} onReset={()=>setEdited(undefined)}>
     <input type="hidden" name="workspace" value={workspace}/><input type="hidden" name="expected" value={JSON.stringify(expected)}/>
     <div className="catalog-editor-actions no-print">{edited?<button type="button" onClick={()=>setEdited(undefined)}>Thêm mới</button>:<button type="submit">Thêm mới</button>}<button type={edited?"submit":"button"} disabled={!edited}>Cập nhật</button><button type="button" className="button-secondary" disabled={!edited} onClick={()=>setEdited(undefined)}>Hủy</button></div>
     <div className="catalog-form-grid material-form-grid"><label>Tên vật tư (*)<input name="name" required maxLength={200} defaultValue={edited?.name??""} placeholder="Nhập tên vật tư"/></label><label>Mã vật tư (*)<input name="code" maxLength={40} required readOnly={Boolean(edited)} defaultValue={edited?.code??""} placeholder="Nhập mã vật tư"/></label><label>Nhóm phương tiện<select name="equipment_category" defaultValue={edited?.equipment_category??""}><option value="">Chưa phân loại</option>{Object.entries(materialCategoryLabels).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label><label>Đơn vị tính (*)<input name="unit" required maxLength={40} readOnly={Boolean(edited)} defaultValue={edited?.unit??""} placeholder="Ví dụ: chiếc, bộ, mét"/></label></div>
     <p className="catalog-editor-help muted">Tên vật tư là nội dung hiển thị chính; mã và đơn vị tính được giữ nguyên sau khi đã phát sinh dữ liệu.</p>
    </AsyncForm>
   </section>:<section className="panel"><p>Bạn được xem danh mục. Chỉ người có quyền quản lý vật tư được thêm hoặc sửa.</p></section>}
   </div>
   <section className="panel material-list data-workbench-results"><div className="section-heading material-directory-heading"><h2>Danh sách vật tư</h2><div className="catalog-directory-summary"><span>{found.length} / {rows.length} mã{duplicates.length?` · ${duplicates.length} nhóm cần kiểm tra trùng`:""}</span><button type="button" className="button-secondary" onClick={resetFilters} disabled={!hasFilters}>Xóa lọc</button></div></div>
   <div className="overflow-x-auto catalog-table-scroll data-workbench-table"><table className="compact-table material-simple-table"><thead><tr><th>STT</th><th>Tên vật tư</th><th>Mã vật tư</th><th>Đơn vị</th><th>Nhóm phương tiện</th><th>Định mức giờ</th><th>Theo dõi</th><th>Sửa</th></tr><tr className="catalog-filter-row"><th/><th><input aria-label="Lọc theo tên vật tư" value={name} onChange={event=>{setName(event.target.value);setPage(1);}} placeholder="Tìm kiếm…"/></th><th><input aria-label="Lọc theo mã vật tư" value={code} onChange={event=>{setCode(event.target.value);setPage(1);}} placeholder="Tìm kiếm…"/></th><th><input aria-label="Lọc theo đơn vị tính" value={unit} onChange={event=>{setUnit(event.target.value);setPage(1);}} placeholder="Tìm kiếm…"/></th><th><select aria-label="Lọc theo nhóm phương tiện" value={category} onChange={event=>{setCategory(event.target.value);setPage(1);}}><option value="">Tất cả</option><option value="unknown">Chưa phân loại</option>{Object.entries(materialCategoryLabels).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></th><th><select aria-label="Lọc theo định mức giờ" value={limit} onChange={event=>{setLimit(event.target.value);setPage(1);}}><option value="">Tất cả</option><option value="with">Đã có</option><option value="without">Chưa có</option></select></th><th/><th/></tr></thead><tbody>{visible.map((row,index)=><tr key={row.id} className={duplicateIds.has(row.id)?"material-duplicate-row":""}><td>{(currentPage-1)*pageSize+index+1}</td><th scope="row" className="material-name-cell" title={row.name}>{row.name}</th><td><code>{row.code}</code></td><td>{row.unit}</td><td>{row.equipment_category?materialCategoryLabels[row.equipment_category]??"Chưa phân loại":"Chưa phân loại"}</td><td>{formatNumber(row.service_limit_hours)}</td><td><Link className="catalog-icon-action catalog-view-action" title={`Theo dõi ${row.name}`} aria-label={`Theo dõi ${row.name}`} href={`/life?workspace=${workspace}&material=${encodeURIComponent(row.code)}`}>↗</Link></td><td>{canEdit?<button type="button" className="catalog-icon-action catalog-edit-action" title={`Sửa ${row.name}`} aria-label={`Sửa ${row.name}`} onClick={()=>setEdited(row)}>✎</button>:<span aria-hidden="true">—</span>}</td></tr>)}</tbody></table></div>
   <TablePagination page={currentPage} total={found.length} pageSize={pageSize} onChange={setPage} onPageSizeChange={changePageSize}/>
   {!visible.length&&<p className="material-simple-empty">{rows.length?"Không tìm thấy vật tư phù hợp.":"Chưa có vật tư trong danh mục."}</p>}
  </section>
  </div>
  <details className="panel material-import-secondary" id="nhap-tu-tep-materials" open={openImport}><summary>Nhập danh mục vật tư từ Excel</summary><div className="table-import-content"><TableImporter workspace={workspace} kind="materials" canImport={canEdit} embedded/></div></details>
  <p className="muted catalog-safety-note">Không xóa cứng vật tư đã có lịch sử. Khi cần chuẩn hóa, dùng nút “Sửa”; dữ liệu theo dõi và định mức được giữ nguyên.</p>
 </div>;
}

