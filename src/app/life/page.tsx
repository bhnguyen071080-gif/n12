import Link from "next/link";
import {context} from "@/lib/supabase";
import {formatNumber,localInputNow,monthStart} from "@/lib/domain";
import {actualDay,defaultEndMonth,dayLabel,monthLabel} from "@/lib/monthly-hours";
import {lifeReportSchema,type MaterialHours} from "@/lib/followup";
import {materialReplacementSchema} from "@/lib/material-replacements";
import {WorkspaceSelect} from "@/components/workspace-select";
import {MaterialStandard} from "@/components/case-editor";
import {MaterialReplacementHistory} from "@/components/material-replacement-history";
import {equipmentLabel} from "@/lib/equipment-display";
export const dynamic="force-dynamic";
const alerts:Record<string,string>={incomplete:"Thiếu giờ tháng",no_limit:"Chưa đặt định mức",overdue:"Đỏ · quá định mức",due_soon:"Vàng · gần tới hạn",normal:"Xanh · bình thường"};
const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").toLowerCase();
const yearBefore=(day:string)=>{const date=new Date(day+"T12:00:00+07:00");date.setUTCFullYear(date.getUTCFullYear()-1);return localInputNow(date).slice(0,10);};

export default async function Life({searchParams}:{searchParams:Promise<{workspace?:string;equipment?:string;from?:string;to?:string;material?:string}>}){
 const p=await searchParams,c=await context(p.workspace);if(!c.workspace)return <p>Chưa có workspace.</p>;const w=c.workspace.id;
 const [equipment,materials,membership,standards]=await Promise.all([
  c.client.from("equipment").select("id,code,name,category").eq("workspace_id",w).order("name"),
  c.client.from("materials").select("*").eq("workspace_id",w).order("name"),
  c.client.from("workspace_memberships").select("role").eq("workspace_id",w).eq("user_id",c.user.id).eq("active",true),
  c.client.from("material_limit_versions").select("material_id,effective_from,limit_hours,warning_hours,source_document").eq("workspace_id",w).order("effective_from",{ascending:false})
 ]);
 if(equipment.error||materials.error||membership.error||standards.error)throw new Error("Không đọc được danh mục/định mức.");
 const selected=p.equipment?equipment.data.find(row=>row.id===p.equipment):undefined;if(p.equipment&&!selected)return <p>Phương tiện không hợp lệ.</p>;
 const today=localInputNow().slice(0,10),rawTo=p.to??today,toInput=/^\d{4}-\d{2}$/.test(rawTo)?rawTo+"-01":rawTo;
 let from:string,toDay:string;try{from=actualDay(p.from??yearBefore(today));toDay=actualDay(toInput);if(from>toDay)throw new Error();}catch{return <p>Khoảng ngày không hợp lệ. Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>;}
 const currentMonth=monthStart(today.slice(0,7)),current=equipment.data.length?await c.client.from("monthly_operating_hours").select("id").in("equipment_id",selected?[selected.id]:equipment.data.map(row=>row.id)).eq("month",currentMonth).limit(1):{data:[],error:null};
 if(current.error)throw new Error("Không đọc được giờ tháng hiện tại.");
 const alertTo=p.to?monthStart(toDay.slice(0,7)):monthStart(defaultEndMonth(Boolean(current.data?.length)));
 const [report,replacementReport]=await Promise.all([
  selected?c.client.rpc("report_material_hours",{p_equipment:selected.id,p_to:alertTo}):c.client.rpc("report_workspace_material_hours",{p_workspace:w,p_to:alertTo}),
  c.client.rpc("report_material_replacements",{p_workspace:w,p_from:from,p_to:toDay,p_equipment:selected?.id??null,p_query:p.material?.trim()??"",p_limit:500})
 ]);
 if(report.error)throw new Error("Không tính được giờ theo lượt thay.");
 if(replacementReport.error)throw new Error("Không đọc được lịch sử thay vật tư.");
 const search=normalize(p.material?.trim()??"");
 const allRows:Array<MaterialHours&{equipment_id:string;equipment_code:string}>=selected?lifeReportSchema.array().parse(report.data).map(row=>({...row,equipment_id:selected.id,equipment_code:selected.code})):(report.data??[]) as Array<MaterialHours&{equipment_id:string;equipment_code:string}>;
 const rows=allRows.filter(row=>!search||normalize(row.material_code+" "+row.material_name).includes(search));
 const replacementRows=materialReplacementSchema.array().parse(replacementReport.data??[]),equipmentById=new Map(equipment.data.map(item=>[item.id,item]));
 const counts=rows.reduce((result,row)=>({...result,[row.alert_level]:(result[row.alert_level]??0)+1}),{} as Record<string,number>),canEdit=membership.data.some(row=>row.role==="CAN_BO_VAT_TU"||row.role==="TRUONG_BO_PHAN_KY_THUAT");
 const filterParams=new URLSearchParams({workspace:w});
 return <><div className="history-screen-heading"><div><p className="eyebrow">VẬT TƯ ĐÃ LẮP LÊN PHƯƠNG TIỆN</p><h1>Theo dõi thay thế vật tư & định mức</h1><p>Tra cứu toàn bộ lịch sử thay thế và cảnh báo tuổi thọ từ cùng dữ liệu vụ việc. Không nhập lại ngày thay, phương tiện hoặc số lượng.</p></div><nav className="life-jump-links" aria-label="Đi nhanh"><a className="button button-secondary" href="#lich-su-thay-the">Lịch sử thay thế</a><a className="button button-secondary" href="#canh-bao-dinh-muc">Cảnh báo hiện tại</a></nav></div>
 <WorkspaceSelect workspaces={c.workspaces} selected={w}/>
 <form method="get" className="panel life-filters"><input name="workspace" type="hidden" value={w}/><label>Phương tiện<select name="equipment" defaultValue={selected?.id??""}><option value="">Tất cả phương tiện</option>{equipment.data.map(row=><option key={row.id} value={row.id}>{equipmentLabel(row)}</option>)}</select></label><label>Từ ngày<input name="from" type="date" defaultValue={from} required/></label><label>Đến ngày<input name="to" type="date" defaultValue={toDay} required/></label><label>Tên hoặc mã vật tư<input name="material" list="material-options" defaultValue={p.material??""} placeholder="Gõ tên hoặc mã vật tư…"/><datalist id="material-options">{materials.data.map(row=><option key={row.id} value={row.code}>{row.name}</option>)}</datalist></label><button type="submit">Tìm kiếm</button><Link className="button button-secondary" href={"/life?"+filterParams}>Làm mới</Link></form>

 <section className="panel" id="lich-su-thay-the"><div className="section-heading"><div><p className="eyebrow">NHẬT KÝ THAY THẾ</p><h2>{selected?equipmentLabel(selected):"Tất cả phương tiện"} · {dayLabel(from)} – {dayLabel(toDay)}</h2><p className="muted">Mỗi dòng là một lần vật tư thực tế đã được đánh dấu “Đã thay” trong vụ việc.</p></div><span className="count-chip">Tự động từ vụ việc</span></div><MaterialReplacementHistory workspace={w} rows={replacementRows}/></section>

 <section id="canh-bao-dinh-muc"><div className="section-heading"><div><p className="eyebrow">TÌNH TRẠNG HIỆN TẠI</p><h2>Cảnh báo đến {monthLabel(alertTo)}</h2></div><span className="count-chip">Lần thay gần nhất / vật tư</span></div><div className="life-alert-stats" aria-label="Cảnh báo định mức"><article className="panel"><span>Xanh · bình thường</span><strong>{counts.normal??0}</strong></article><article className="panel"><span>Vàng · gần tới hạn</span><strong>{counts.due_soon??0}</strong></article><article className="panel"><span>Đỏ · quá hạn</span><strong>{counts.overdue??0}</strong></article><article className="panel"><span>Thiếu dữ liệu giờ</span><strong>{counts.incomplete??0}</strong></article><article className="panel"><span>Chưa có định mức</span><strong>{counts.no_limit??0}</strong></article></div>
 <div className="panel"><div className="overflow-x-auto catalog-table-scroll"><table className="compact-table life-alert-table"><thead><tr><th>Phương tiện</th><th>Vật tư / vị trí</th><th>Lượt thay gần nhất</th><th>Khoảng tháng</th><th>Giờ ghi nhận</th><th>Định mức / còn lại</th><th>Cảnh báo</th></tr></thead><tbody>{rows.map(row=>{const machine=equipmentById.get(row.equipment_id);return <tr className={"alert-"+row.alert_level} key={row.equipment_id+":"+row.material_id}><td><strong>{machine?equipmentLabel(machine):row.equipment_code}</strong></td><td><span className="single-line" title={row.material_name}>{row.material_name}</span><small>{row.material_code} · {row.position||"Chưa ghi vị trí"}</small></td><td><Link href={row.case_id?"/cases/"+row.case_id:"/equipment/"+row.equipment_code+"?workspace="+w}>{row.case_code??row.order_code}</Link><small>{dayLabel(row.performed_on)}</small></td><td><Link href={"/monthly?"+new URLSearchParams({workspace:w,kind:"hours",equipment:row.equipment_id,from:row.from_month.slice(0,7),to:alertTo.slice(0,7)})}>{monthLabel(row.from_month)} → {monthLabel(alertTo)}</Link></td><td>{formatNumber(row.recorded_hours)} h{row.missing_months>0&&<small className="text-red-800">Thiếu {row.missing_months} tháng</small>}</td><td>{formatNumber(row.limit_hours)} / {formatNumber(row.remaining_hours)} h</td><td><strong>{alerts[row.alert_level]??row.alert_level}</strong></td></tr>;})}</tbody></table></div>{!rows.length&&<p>Chưa có lượt thay phù hợp. Chỉ vật tư đã đánh dấu “Đã thay” trong vụ việc mới được tính.</p>}</div></section>

 {canEdit&&<details className="panel material-standards-panel"><summary><strong>Quản lý phiên bản định mức vật tư</strong><span>Mở khi cần cập nhật định mức mới của Cảng Hải Phòng</span></summary><div className="section-heading"><p>Mỗi lần ban hành hoặc điều chỉnh, tạo một phiên bản theo ngày hiệu lực. Bản cũ không bị ghi đè.</p><Link className="button button-secondary" href={"/materials?workspace="+w+"&import=materials"}>Mở danh mục vật tư</Link></div>{(()=>{const latest=new Map<string,(typeof standards.data)[number]>();for(const row of standards.data)if(!latest.has(row.material_id))latest.set(row.material_id,row);const ids=new Set([...latest.keys()]);return materials.data.filter(row=>row.service_limit_hours!==null||ids.has(row.id)).map(row=><MaterialStandard key={row.id+":"+(latest.get(row.id)?.effective_from??"legacy")} workspace={w} today={today} material={row} current={latest.get(row.id)}/>);})()}</details>}</>;
}

