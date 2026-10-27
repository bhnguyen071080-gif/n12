"use client";
import Link from "next/link";
import {useDeferredValue,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {saveMaterial} from "@/app/materials/actions";
import {filterMaterialCatalog,materialCatalogStats,materialCategoryLabels,materialDuplicateGroups,type MaterialCatalogRow,type MaterialQualityFilter,type MaterialSort} from "@/lib/material-catalog";
import {formatNumber} from "@/lib/domain";
import {TableImporter} from "./table-importer";
import {AsyncForm} from "./async-form";
import {Icon} from "./icons";
import {TablePagination} from "./table-pagination";
import {paginate} from "@/lib/pagination";
export function MaterialCatalog({workspace,rows,canEdit,openImport=false}:{workspace:string;rows:MaterialCatalogRow[];canEdit:boolean;openImport?:boolean}){
 const router=useRouter(),[view,setView]=useState<"list"|"manual">("list"),[edited,setEdited]=useState<MaterialCatalogRow>(),[importVisible,setImportVisible]=useState(openImport),[search,setSearch]=useState(""),[category,setCategory]=useState(""),[quality,setQuality]=useState<MaterialQualityFilter>(""),[sort,setSort]=useState<MaterialSort>("name"),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(25);
 const deferredSearch=useDeferredValue(search);
 const duplicates=useMemo(()=>materialDuplicateGroups(rows),[rows]);
 const stats=useMemo(()=>materialCatalogStats(rows),[rows]);
 const found=useMemo(()=>filterMaterialCatalog(rows,{query:deferredSearch,category,quality,sort}),[rows,deferredSearch,category,quality,sort]);
 const pagination=paginate(found,page,pageSize),currentPage=pagination.page,visible=pagination.items;
 const expected=edited?{id:edited.id,name:edited.name,unit:edited.unit,equipment_category:edited.equipment_category}:null;
 const resetFilters=()=>{setSearch("");setCategory("");setQuality("");setSort("name");setPage(1);};
 const closeManual=()=>{setEdited(undefined);setView("list");};
 const changePageSize=(size:number)=>{setPageSize(size);setPage(1);};
 return <div className="material-catalog data-workbench">
  <div className="data-workbench-entry space-y-5">
  <section className="panel material-actions"><div className="section-heading"><div><p className="eyebrow">TÁC VỤ DANH MỤC</p><h2>Chọn cách cập nhật vật tư</h2></div><span className="count-chip">{rows.length} mã vật tư</span></div><div className="material-action-buttons">{canEdit&&<button type="button" onClick={()=>{setEdited(undefined);setView("manual");}}>Thêm vật tư</button>}<button type="button" className="button button-secondary" aria-expanded={importVisible} onClick={()=>setImportVisible(value=>!value)}>{importVisible?"Đóng phần nhập Excel":"Nhập từ Excel"}</button></div><p className="muted">Danh sách bên dưới là dữ liệu chuẩn. Vật tư đã có lịch sử không xóa cứng; hãy chỉnh sửa tên hoặc nhóm khi cần chuẩn hóa.</p></section>
  <section className="panel" id="nhap-tu-tep-materials" hidden={!importVisible}><div className="section-heading"><div><h2>Nhập vật tư từ bảng mẫu</h2><p className="muted">Kiểm tra và đối chiếu trước khi xác nhận nhập.</p></div><button type="button" className="button button-secondary" onClick={()=>setImportVisible(false)}>Đóng</button></div><p>Tải bảng mẫu, nhập dữ liệu, bấm <strong>Kiểm tra</strong> để đối chiếu với danh mục hiện có rồi mới bấm <strong>Xác nhận nhập</strong>. Mã vật tư là khóa chuẩn; không nhập cùng một vật tư bằng tên viết khác.</p><TableImporter workspace={workspace} kind="materials" canImport={canEdit} embedded/></section>
  <div hidden={view!=="manual"}>
   {canEdit&&<section className="panel"><div className="section-heading"><div><p className="eyebrow">NHẬP TRỰC TIẾP</p><h2>{edited?"Sửa vật tư · "+edited.code:"Thêm vật tư mới"}</h2></div><button type="button" className="button-secondary" onClick={closeManual}>Hủy / về danh sách</button></div>
    <AsyncForm key={edited?JSON.stringify(expected):"new"} action={saveMaterial} label={edited?"Lưu thay đổi vật tư":"Lưu vật tư"} resetLabel="Thêm vật tư khác" resetOnNew onSuccess={()=>router.refresh()} onReset={()=>setEdited(undefined)}>
     <input type="hidden" name="workspace" value={workspace}/><input type="hidden" name="expected" value={JSON.stringify(expected)}/>
     <div className="catalog-fields"><label>Mã vật tư *<input name="code" maxLength={40} required readOnly={Boolean(edited)} defaultValue={edited?.code??""} placeholder="Mã không dấu, không có khoảng trắng"/></label><label>Tên vật tư *<input name="name" required maxLength={200} defaultValue={edited?.name??""}/></label><label>Đơn vị tính *<input name="unit" required maxLength={40} readOnly={Boolean(edited)} defaultValue={edited?.unit??""} placeholder="Ví dụ: chiếc, bộ, mét"/></label><label>Loại phương tiện<select name="equipment_category" defaultValue={edited?.equipment_category??""}><option value="">Chưa phân loại</option>{Object.entries(materialCategoryLabels).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label></div>
     <p className="muted">Chưa rõ loại thì để Chưa phân loại. Mã và đơn vị của vật tư đã có được giữ nguyên. Đây là danh mục, không phải phiếu nhập kho.</p>
    </AsyncForm>
   </section>}
  </div>
  </div>
  <section className="panel material-list data-workbench-results"><div className="section-heading"><div><p className="eyebrow">DỮ LIỆU HIỆN CÓ</p><h2>Danh sách vật tư</h2></div><span className="count-chip">{found.length} / {rows.length} mã</span></div>
   <div className="material-catalog-stats" aria-label="Tóm tắt chất lượng danh mục"><article><strong>{stats.total}</strong><span>Tổng mã</span></article><article><strong>{stats.categorized}</strong><span>Đã phân nhóm</span></article><article><strong>{stats.unclassified}</strong><span>Chưa phân loại</span></article><article><strong>{stats.duplicateIds.size}</strong><span>Mã cần kiểm tra trùng</span></article></div>
   {duplicates.length>0&&<div className="plan-warning" role="status"><strong>Cần kiểm tra {duplicates.length} nhóm trùng tên, đơn vị và nhóm phương tiện:</strong> {duplicates.slice(0,8).map(group=>group.map(row=>row.code).join(" / ")).join("; ")}. Vật tư cùng tên nhưng thuộc nhóm phương tiện khác nhau được giữ riêng.</div>}
   <div className="material-filters material-filters-advanced"><label className="material-search">Tìm nhanh<input type="search" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Tên, mã, đơn vị hoặc nhóm…"/></label><label>Nhóm phương tiện<select value={category} onChange={e=>{setCategory(e.target.value);setPage(1);}}><option value="">Tất cả nhóm</option><option value="unknown">Chưa phân loại</option>{Object.entries(materialCategoryLabels).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label><label>Chất lượng dữ liệu<select value={quality} onChange={e=>{setQuality(e.target.value as MaterialQualityFilter);setPage(1);}}><option value="">Tất cả</option><option value="duplicate">Cần kiểm tra trùng</option><option value="unclassified">Chưa phân loại</option><option value="without_limit">Chưa có định mức</option><option value="with_limit">Đã có định mức</option></select></label><label>Sắp xếp<select value={sort} onChange={e=>{setSort(e.target.value as MaterialSort);setPage(1);}}><option value="name">Theo tên vật tư</option><option value="code">Theo mã vật tư</option><option value="category">Theo nhóm phương tiện</option><option value="limit">Định mức cao trước</option></select></label><button type="button" className="button button-secondary material-filter-reset" disabled={!search&&!category&&!quality&&sort==="name"} onClick={resetFilters}>Xóa bộ lọc</button></div>
   <div className="overflow-x-auto catalog-table-scroll data-workbench-table"><table className="compact-table material-table"><thead><tr><th>STT</th><th>Tên vật tư</th><th>Mã vật tư</th><th>Đơn vị</th><th>Nhóm phương tiện</th><th>Định mức giờ</th><th>Trạng thái dữ liệu</th><th>Thao tác</th></tr></thead><tbody>{visible.map((r,index)=>{const duplicate=stats.duplicateIds.has(r.id),unclassified=!r.equipment_category;return <tr key={r.id}><td>{(currentPage-1)*pageSize+index+1}</td><th scope="row" className="single-line" title={r.name}>{r.name}</th><td><code>{r.code}</code></td><td>{r.unit}</td><td>{r.equipment_category?materialCategoryLabels[r.equipment_category]??"Chưa phân loại":"Chưa phân loại"}</td><td>{formatNumber(r.service_limit_hours)}</td><td>{duplicate?<span className="material-data-badge material-data-warning">Kiểm tra trùng</span>:unclassified?<span className="material-data-badge material-data-neutral">Chưa phân loại</span>:<span className="material-data-badge material-data-ok">Đã chuẩn hóa</span>}</td><td><div className="table-actions"><Link className="button button-secondary table-action" href={`/life?workspace=${workspace}&material=${encodeURIComponent(r.code)}`}>Theo dõi</Link>{canEdit&&<button type="button" className="table-action" onClick={()=>{setEdited(r);setView("manual");}}>Chỉnh sửa</button>}</div></td></tr>;})}</tbody></table></div>
   <TablePagination page={currentPage} total={found.length} pageSize={pageSize} onChange={setPage} onPageSizeChange={changePageSize}/>
   {rows.length?!found.length&&<p>Không tìm thấy vật tư phù hợp. Hãy đổi nội dung tìm kiếm hoặc bộ lọc.</p>:<div className="material-empty"><span><Icon name="layers" width={34} height={34}/></span><div><h3>Chưa có vật tư trong danh mục</h3><p>Tải mẫu Excel, điền dữ liệu rồi bấm Nhập dữ liệu ở phía trên.</p></div></div>}
  </section>
 </div>;
}

