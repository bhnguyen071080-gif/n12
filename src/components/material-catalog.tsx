"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {saveMaterial} from "@/app/materials/actions";
import {materialCategoryLabels,type MaterialCatalogRow} from "@/lib/material-catalog";
import {formatNumber} from "@/lib/domain";
import {TableImporter} from "./table-importer";
import {AsyncForm} from "./async-form";
import {Icon} from "./icons";
export function MaterialCatalog({workspace,rows,canEdit}:{workspace:string;rows:MaterialCatalogRow[];canEdit:boolean;openImport?:boolean}){
 const router=useRouter(),[view,setView]=useState<"list"|"manual">("list"),[edited,setEdited]=useState<MaterialCatalogRow>(),[search,setSearch]=useState(""),[category,setCategory]=useState("");
 const normalize=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").toLowerCase();
 const found=rows.filter(r=>(!category||(category==="unknown"?!r.equipment_category:r.equipment_category===category))&&normalize(r.code+" "+r.name).includes(normalize(search.trim())));
 const names=new Map<string,MaterialCatalogRow[]>();for(const row of rows){const key=normalize(row.name).replace(/[^a-z0-9]+/g," ").trim()+"|"+normalize(row.unit);names.set(key,[...(names.get(key)??[]),row]);}
 const duplicates=[...names.values()].filter(group=>group.length>1);
 const expected=edited?{id:edited.id,name:edited.name,unit:edited.unit,equipment_category:edited.equipment_category}:null;
 return <div className="material-catalog space-y-5">
  <section className="panel" id="nhap-tu-tep-materials"><h2>Nhập vật tư từ bảng mẫu</h2><p>Tải bảng mẫu, nhập dữ liệu, bấm <strong>Kiểm tra</strong> để đối chiếu với danh mục hiện có rồi mới bấm <strong>Xác nhận nhập</strong>. Mã vật tư là khóa chuẩn; không nhập cùng một vật tư bằng tên viết khác.</p><TableImporter workspace={workspace} kind="materials" canImport={canEdit} embedded/></section>
  <div hidden={view!=="manual"}>
   {canEdit&&<section className="panel"><div className="section-heading"><div><p className="eyebrow">NHẬP TRỰC TIẾP</p><h2>{edited?"Sửa vật tư · "+edited.code:"Thêm vật tư mới"}</h2></div><button type="button" className="button-secondary" onClick={()=>setView("list")}>Về danh sách</button></div>
    <AsyncForm key={edited?JSON.stringify(expected):"new"} action={saveMaterial} label={edited?"Lưu thay đổi vật tư":"Lưu vật tư"} resetLabel="Thêm vật tư khác" resetOnNew onSuccess={()=>router.refresh()} onReset={()=>setEdited(undefined)}>
     <input type="hidden" name="workspace" value={workspace}/><input type="hidden" name="expected" value={JSON.stringify(expected)}/>
     <div className="catalog-fields"><label>Mã vật tư *<input name="code" maxLength={40} required readOnly={Boolean(edited)} defaultValue={edited?.code??""} placeholder="Mã không dấu, không có khoảng trắng"/></label><label>Tên vật tư *<input name="name" required maxLength={200} defaultValue={edited?.name??""}/></label><label>Đơn vị tính *<input name="unit" required maxLength={40} readOnly={Boolean(edited)} defaultValue={edited?.unit??""} placeholder="Ví dụ: chiếc, bộ, mét"/></label><label>Loại phương tiện<select name="equipment_category" defaultValue={edited?.equipment_category??""}><option value="">Chưa phân loại</option>{Object.entries(materialCategoryLabels).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label></div>
     <p className="muted">Chưa rõ loại thì để Chưa phân loại. Mã và đơn vị của vật tư đã có được giữ nguyên. Đây là danh mục, không phải phiếu nhập kho.</p>
    </AsyncForm>
   </section>}
  </div>
  <section className="panel material-list"><div className="section-heading"><div><p className="eyebrow">DỮ LIỆU HIỆN CÓ</p><h2>Danh sách vật tư</h2></div><div className="flex flex-wrap items-center gap-3"><span className="count-chip">{found.length} / {rows.length} mã</span>{canEdit&&<button type="button" className="button-secondary" onClick={()=>{setEdited(undefined);setView("manual");}}>Thêm vật tư bằng tay</button>}</div></div>
   {duplicates.length>0&&<div className="plan-warning" role="status"><strong>Cần kiểm tra {duplicates.length} nhóm có cùng tên và đơn vị:</strong> {duplicates.slice(0,8).map(group=>group.map(row=>row.code).join(" / ")).join("; ")}. Giữ một mã chuẩn hoặc xác nhận đây là các danh điểm khác nhau.</div>}
   <div className="material-filters"><label>Tìm vật tư<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nhập mã hoặc tên vật tư…"/></label><label>Lọc loại phương tiện<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Tất cả loại phương tiện</option><option value="unknown">Chưa phân loại</option>{Object.entries(materialCategoryLabels).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label></div>
   <div className="overflow-x-auto"><table><thead><tr><th>Mã vật tư</th><th>Tên vật tư</th><th>Đơn vị</th><th>Loại phương tiện</th><th>Định mức giờ</th>{canEdit&&<th>Thao tác</th>}</tr></thead><tbody>{found.map(r=><tr key={r.id}><td><strong>{r.code}</strong></td><td>{r.name}</td><td>{r.unit}</td><td>{r.equipment_category?materialCategoryLabels[r.equipment_category]??"Chưa phân loại":"Chưa phân loại"}</td><td>{formatNumber(r.service_limit_hours)}</td>{canEdit&&<td><button type="button" className="button-secondary" onClick={()=>{setEdited(r);setView("manual");}}>Sửa</button></td>}</tr>)}</tbody></table></div>
   {rows.length?!found.length&&<p>Không tìm thấy vật tư phù hợp. Hãy đổi nội dung tìm kiếm hoặc bộ lọc.</p>:<div className="material-empty"><span><Icon name="layers" width={34} height={34}/></span><div><h3>Chưa có vật tư trong danh mục</h3><p>Tải mẫu Excel, điền dữ liệu rồi bấm Nhập dữ liệu ở phía trên.</p></div></div>}
  </section>
 </div>;
}
