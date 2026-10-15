"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {saveMaterial} from "@/app/materials/actions";
import {materialCategoryLabels,type MaterialCatalogRow} from "@/lib/material-catalog";
import {formatNumber} from "@/lib/domain";
import {TableImporter} from "./table-importer";
import {AsyncForm} from "./async-form";
import {Icon} from "./icons";
export function MaterialCatalog({workspace,rows,canEdit,openImport=false}:{workspace:string;rows:MaterialCatalogRow[];canEdit:boolean;openImport?:boolean}){
 const router=useRouter(),[view,setView]=useState<"list"|"manual"|"file">(openImport?"file":"list"),[edited,setEdited]=useState<MaterialCatalogRow>(),[search,setSearch]=useState(""),[category,setCategory]=useState("");
 const normalize=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").toLowerCase();
 const found=rows.filter(r=>(!category||(category==="unknown"?!r.equipment_category:r.equipment_category===category))&&normalize(r.code+" "+r.name).includes(normalize(search.trim())));
 const expected=edited?{id:edited.id,name:edited.name,unit:edited.unit,equipment_category:edited.equipment_category}:null;
 return <div className="material-catalog space-y-5">
  <section className="panel material-actions"><div><p className="eyebrow">CẬP NHẬT DANH MỤC</p><h2>Thêm vật tư theo cách thuận tiện</h2><p className="muted">Nhập từng mã bằng tay hoặc nhập nhiều dòng từ Excel. Tất cả thao tác ngay tại trang này.</p></div>
   <div className="material-action-buttons"><button type="button" disabled={!canEdit} aria-pressed={view==="manual"} onClick={()=>{setEdited(undefined);setView("manual");}}>+ Thêm vật tư</button><button type="button" className="button-secondary" aria-pressed={view==="file"} onClick={()=>setView("file")}><Icon name="layers"/>Nhập từ tệp Excel / CSV</button><a className="button button-secondary" href="/api/import-template?kind=materials">Tải mẫu Excel vật tư</a></div>
   {!canEdit&&<p>Bạn được xem và tải mẫu. Chỉ cán bộ vật tư hoặc trưởng khu vực được lưu.</p>}
  </section>
  <div className="material-view-switch" aria-label="Chọn nội dung làm việc">{([['list','Danh sách vật tư'],['manual','Nhập tay'],['file','Nhập từ tệp']] as const).map(([v,label])=><button key={v} type="button" className="button-secondary" aria-pressed={view===v} disabled={v==="manual"&&!canEdit} onClick={()=>setView(v)}>{label}</button>)}</div>
  <div hidden={view!=="manual"}>
   {canEdit&&<section className="panel"><div className="section-heading"><div><p className="eyebrow">NHẬP TRỰC TIẾP</p><h2>{edited?"Sửa vật tư · "+edited.code:"Thêm vật tư mới"}</h2></div><button type="button" className="button-secondary" onClick={()=>setView("list")}>Về danh sách</button></div>
    <AsyncForm key={edited?JSON.stringify(expected):"new"} action={saveMaterial} label={edited?"Lưu thay đổi vật tư":"Lưu vật tư"} resetLabel="Thêm vật tư khác" resetOnNew onSuccess={()=>router.refresh()} onReset={()=>setEdited(undefined)}>
     <input type="hidden" name="workspace" value={workspace}/><input type="hidden" name="expected" value={JSON.stringify(expected)}/>
     <div className="catalog-fields"><label>Mã vật tư *<input name="code" maxLength={40} required readOnly={Boolean(edited)} defaultValue={edited?.code??""} placeholder="Mã không dấu, không có khoảng trắng"/></label><label>Tên vật tư *<input name="name" required maxLength={200} defaultValue={edited?.name??""}/></label><label>Đơn vị tính *<input name="unit" required maxLength={40} readOnly={Boolean(edited)} defaultValue={edited?.unit??""} placeholder="Ví dụ: chiếc, bộ, mét"/></label><label>Loại phương tiện<select name="equipment_category" defaultValue={edited?.equipment_category??""}><option value="">Chưa phân loại</option>{Object.entries(materialCategoryLabels).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label></div>
     <p className="muted">Chưa rõ loại thì để Chưa phân loại. Mã và đơn vị của vật tư đã có được giữ nguyên. Đây là danh mục, không phải phiếu nhập kho.</p>
    </AsyncForm>
   </section>}
  </div>
  <div hidden={view!=="file"} id="nhap-tu-tep-materials"><section className="panel material-import-guide"><h2>Nhập nhiều vật tư từ tệp</h2><ol><li>Tải mẫu Excel vật tư và điền từ dòng 2.</li><li>Chọn tệp đã điền ở bên dưới.</li><li>Bấm Kiểm tra và xem trước, đối chiếu rồi Xác nhận nhập.</li></ol><p className="muted">Bốn cột: mã vật tư, tên vật tư, đơn vị tính, loại phương tiện. Tệp cũ 3 cột vẫn nhận và không thay loại đã có.</p><TableImporter workspace={workspace} kind="materials" canImport={canEdit} embedded templateHref="/api/import-template?kind=materials"/></section></div>
  <section className="panel material-list"><div className="section-heading"><div><p className="eyebrow">DỮ LIỆU HIỆN CÓ</p><h2>Danh sách vật tư</h2></div><span className="count-chip">{found.length} / {rows.length} mã</span></div>
   <div className="material-filters"><label>Tìm vật tư<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nhập mã hoặc tên vật tư…"/></label><label>Lọc loại phương tiện<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Tất cả loại phương tiện</option><option value="unknown">Chưa phân loại</option>{Object.entries(materialCategoryLabels).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label></div>
   <div className="overflow-x-auto"><table><thead><tr><th>Mã vật tư</th><th>Tên vật tư</th><th>Đơn vị</th><th>Loại phương tiện</th><th>Định mức giờ</th>{canEdit&&<th>Thao tác</th>}</tr></thead><tbody>{found.map(r=><tr key={r.id}><td><strong>{r.code}</strong></td><td>{r.name}</td><td>{r.unit}</td><td>{r.equipment_category?materialCategoryLabels[r.equipment_category]??"Chưa phân loại":"Chưa phân loại"}</td><td>{formatNumber(r.service_limit_hours)}</td>{canEdit&&<td><button type="button" className="button-secondary" onClick={()=>{setEdited(r);setView("manual");}}>Sửa</button></td>}</tr>)}</tbody></table></div>
   {rows.length?!found.length&&<p>Không tìm thấy vật tư phù hợp. Hãy đổi nội dung tìm kiếm hoặc bộ lọc.</p>:<div className="material-empty"><span><Icon name="layers" width={34} height={34}/></span><div><h3>Chưa có vật tư trong danh mục</h3><p>Chọn Thêm vật tư để nhập tay, hoặc Nhập từ tệp Excel / CSV để cập nhật nhiều dòng.</p></div></div>}
  </section>
 </div>;
}
