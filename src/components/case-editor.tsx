"use client";
import {useRouter} from "next/navigation";
import {createTrackingCase,saveTrackingItem,addTrackingMaterial,updateTrackingMaterial,setMaterialReturn,saveMaterialCatalogue} from "@/app/followup-actions";
import {kinds,kindLabels,progressOptions,progressNames,defaults,supplyLabels,type WorkItem} from "@/lib/followup";
import {formatNumber,localInputNow} from "@/lib/domain";
import {AsyncForm} from "./async-form";
type Material={id:string;code:string;name:string;unit:string};
type Usage={id:string;material_id:string;quantity:number;supply_state:"planned"|"borrowed"|"issued";is_installed:boolean;installation_position:string};
type Followup={case_id:string;return_status:"pending"|"completed";completed_at:string|null;notes:string;version_no:number};
export function CaseEntry({equipment}:{equipment:{id:string;code:string}[]}){
 const router=useRouter();
 return <section className="panel"><h2>Tạo vụ việc</h2><p>Mã tự sinh theo thời điểm nhập. Ngày thực hiện bên dưới là ngày công việc ghi trong lý lịch.</p>
 <AsyncForm action={createTrackingCase} onSuccess={r=>{if(r.id)router.push("/cases/"+r.id);}} label="Tạo vụ việc">
 <label>Phương tiện<select name="equipment" required>{equipment.map(e=><option key={e.id} value={e.id}>{e.code}</option>)}</select></label>
 <label>Loại việc<select name="kind">{kinds.map(k=><option key={k} value={k}>{kindLabels[k]}</option>)}</select></label>
 <label>Ngày thực hiện<input name="performed_on" type="date" defaultValue={localInputNow().slice(0,10)} required/></label>
 <label>Nội dung vụ việc<textarea name="summary" required maxLength={8000} rows={3}/></label></AsyncForm></section>;
}
export function ItemEditor({order,item}:{order:string;item?:WorkItem}){
 const router=useRouter();
 return <AsyncForm action={saveTrackingItem} onSuccess={()=>router.refresh()} label={item?"Lưu nội dung & tiến độ":"Thêm hạng mục"}>
 <input name="order" type="hidden" value={order}/><input name="item" type="hidden" value={item?.id??""}/><input name="version" type="hidden" value={item?.version_no??""}/>
 <label>Ngày thực hiện ghi trong lý lịch<input name="performed_on" type="date" defaultValue={item?.performed_on??""}/></label>
 <div className="grid gap-3 md:grid-cols-2">{([["symptom","Hiện tượng"],["root_cause","Nguyên nhân"],["solution_plan","Phương án"],["execution_result","Kết quả"]] as const).map(([key,label])=>
 <label key={key}>{label}<textarea name={key} defaultValue={item?.[key]??""} rows={3} maxLength={8000}/></label>)}</div>
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{(Object.keys(progressOptions) as (keyof typeof progressOptions)[]).map(key=>
 <label key={key}>{progressNames[key]}<select name={key} defaultValue={item?.[key]??defaults[key]}>{Object.entries(progressOptions[key]).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>)}</div>
 <p>Database kiểm tra quyền từng nhóm. Hoàn thành cần đủ bốn nội dung và ngày thực hiện.</p></AsyncForm>;
}
export function MaterialsEditor({item,materials,usages}:{item:string;materials:Material[];usages:Usage[]}){
 const router=useRouter(),catalogue=new Map(materials.map(m=>[m.id,m]));
 return <><h3 className="font-bold">Vật tư thuộc hạng mục</h3>{usages.map(u=>{const m=catalogue.get(u.material_id);return <div className="border-t py-3" key={u.id+":"+u.supply_state+":"+u.is_installed}>
 <p>{m?.code} · {m?.name} · {formatNumber(u.quantity,3)} {m?.unit} · {u.installation_position||"Không ghi vị trí"}</p>
 <AsyncForm action={updateTrackingMaterial} onSuccess={()=>router.refresh()} label="Cập nhật vật tư"><input name="usage" type="hidden" value={u.id}/>
 <label>Vay/lĩnh<select name="supply" defaultValue={u.supply_state}>{Object.entries(supplyLabels).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>
 <label><input name="installed" type="checkbox" defaultChecked={u.is_installed}/> Đã thay/lắp lên phương tiện</label></AsyncForm></div>;})}
 <details className="border-t pt-3"><summary className="mb-3 cursor-pointer font-bold">Thêm dòng vật tư</summary>
 <AsyncForm action={addTrackingMaterial} onSuccess={()=>router.refresh()} label="Thêm vật tư"><input name="item" type="hidden" value={item}/>
 <label>Vật tư<select name="material" required>{materials.map(m=><option key={m.id} value={m.id}>{m.code} · {m.name} ({m.unit})</option>)}</select></label>
 <label>Số lượng<input name="quantity" type="number" step="0.001" min="0.001" required/></label>
 <label>Vay/lĩnh<select name="supply">{Object.entries(supplyLabels).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>
 <label>Vị trí (nếu cần)<input name="position" maxLength={200}/></label>
 <label><input name="installed" type="checkbox"/> Đã thay — lấy ngày thực hiện của hạng mục</label></AsyncForm></details></>;
}
export function ReturnEditor({followup}:{followup:Followup}){
 const router=useRouter();
 return <section className="panel"><h2>Trả phiếu kho chung theo vụ việc</h2><p>{followup.return_status==="completed"?"Đã hoàn tất":"Chưa hoàn tất"}{followup.completed_at?" · "+new Date(followup.completed_at).toLocaleString("vi-VN",{timeZone:"Asia/Bangkok"}):""}</p>
 <p>Không lập phiếu tại đây. Bổ sung vật tư tự mở lại trạng thái; lần hoàn tất trước giữ trong nhật ký.</p>
 <AsyncForm action={setMaterialReturn} onSuccess={()=>router.refresh()}><input name="case" type="hidden" value={followup.case_id}/><input name="version" type="hidden" value={followup.version_no}/>
 <label>Trạng thái trả phiếu<select name="return_status" defaultValue={followup.return_status}><option value="pending">Chưa hoàn tất trả phiếu</option><option value="completed">Đã hoàn tất trả phiếu</option></select></label>
 <label>Thời gian hoàn tất trả phiếu<input name="completed_at" type="datetime-local" defaultValue={localInputNow(followup.completed_at?new Date(followup.completed_at):new Date())}/></label>
 <label>Ghi chú<textarea name="notes" defaultValue={followup.notes} maxLength={4000}/></label></AsyncForm></section>;
}
export function MaterialEntry({workspace}:{workspace:string}){
 const router=useRouter();
 return <section className="panel"><h2>Bổ sung danh mục vật tư</h2><p>Chỉ khai báo để chọn trong vụ việc, không nhập tồn kho.</p>
 <AsyncForm action={saveMaterialCatalogue} onSuccess={()=>router.refresh()}><input name="workspace" type="hidden" value={workspace}/>
 <label>Mã vật tư<input name="code" required maxLength={50}/></label><label>Tên vật tư<input name="name" required maxLength={200}/></label><label>Đơn vị<input name="unit" required maxLength={40}/></label>
 <label>Định mức giờ (nếu áp dụng)<input name="limit" type="number" min="0.01" step="0.01"/></label><label>Cảnh báo trước (giờ)<input name="warning" type="number" min="0" step="0.01" defaultValue={25} required/></label></AsyncForm></section>;
}
export function MaterialLimit({material}:{material:{id:string;code:string;name:string;service_limit_hours:number|null;service_warning_hours:number}}){
 const router=useRouter();
 return <details><summary className="mb-3 cursor-pointer font-bold">{material.code} · {material.name}</summary>
 <AsyncForm action={saveMaterialCatalogue} onSuccess={()=>router.refresh()} label="Lưu định mức"><input name="material" type="hidden" value={material.id}/>
 <label>Định mức giờ (để trống nếu không áp dụng)<input name="limit" type="number" min="0.01" step="0.01" defaultValue={material.service_limit_hours??""}/></label>
 <label>Cảnh báo trước (giờ)<input name="warning" type="number" min="0" step="0.01" defaultValue={material.service_warning_hours} required/></label></AsyncForm></details>;
}
