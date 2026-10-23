import Link from "next/link";
import {context} from "@/lib/supabase";
import {formatNumber,localInputNow,monthStart} from "@/lib/domain";
import {defaultEndMonth,dayLabel,monthLabel} from "@/lib/monthly-hours";
import {lifeReportSchema,type MaterialHours} from "@/lib/followup";
import {WorkspaceSelect} from "@/components/workspace-select";
import {MaterialLimit} from "@/components/case-editor";
export const dynamic="force-dynamic";
const alerts:Record<string,string>={incomplete:"Thiếu giờ tháng",no_limit:"Chưa đặt định mức",overdue:"Đỏ · quá định mức",due_soon:"Vàng · gần tới hạn",normal:"Xanh · bình thường"};
const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").toLowerCase();

export default async function Life({searchParams}:{searchParams:Promise<{workspace?:string;equipment?:string;to?:string;material?:string}>}){
 const p=await searchParams,c=await context(p.workspace);if(!c.workspace)return <p>Chưa có workspace.</p>;const w=c.workspace.id;
 const [equipment,materials,membership]=await Promise.all([
 c.client.from("equipment").select("id,code,name,category").eq("workspace_id",w).order("code"),c.client.from("materials").select("*").eq("workspace_id",w).order("code"),
 c.client.from("workspace_memberships").select("role").eq("workspace_id",w).eq("user_id",c.user.id).eq("active",true)]);
 if(equipment.error||materials.error||membership.error)throw new Error("Không đọc được danh mục.");
 const selected=p.equipment?equipment.data.find(row=>row.id===p.equipment):undefined;if(p.equipment&&!selected)return <p>Phương tiện không hợp lệ.</p>;
 const currentMonth=monthStart(localInputNow().slice(0,7)),current=equipment.data.length?await c.client.from("monthly_operating_hours").select("id").in("equipment_id",selected?[selected.id]:equipment.data.map(row=>row.id)).eq("month",currentMonth).limit(1):{data:[],error:null};
 if(current.error)throw new Error("Không đọc được giờ tháng hiện tại.");const to=p.to??defaultEndMonth(Boolean(current.data?.length));let end;try{end=monthStart(to);}catch{return <p>Đến tháng–năm không hợp lệ.</p>;}
 const report=selected?await c.client.rpc("report_material_hours",{p_equipment:selected.id,p_to:end}):await c.client.rpc("report_workspace_material_hours",{p_workspace:w,p_to:end});
 if(report.error)throw new Error("Không tính được giờ theo lượt thay.");
 const search=normalize(p.material?.trim()??"");
 const allRows:Array<MaterialHours&{equipment_id:string;equipment_code:string}>=selected?lifeReportSchema.array().parse(report.data).map(row=>({...row,equipment_id:selected.id,equipment_code:selected.code})):(report.data??[]) as Array<MaterialHours&{equipment_id:string;equipment_code:string}>;
 const rows=allRows.filter(row=>!search||normalize(row.material_code+" "+row.material_name).includes(search));
 const counts=rows.reduce((result,row)=>({...result,[row.alert_level]:(result[row.alert_level]??0)+1}),{} as Record<string,number>),canEdit=membership.data.some(row=>row.role==="CAN_BO_VAT_TU"||row.role==="TRUONG_BO_PHAN_KY_THUAT");
 return <><h1>Giờ vật tư & cảnh báo định mức</h1><WorkspaceSelect workspaces={c.workspaces} selected={w}/><p>Hệ thống tự lấy lượt thay gần nhất trong vụ việc, cộng giờ hoạt động đến tháng kiểm tra và phân màu cảnh báo. Không nhập lại ngày thay hoặc số giờ đã chạy.</p>
 <section className="plan-stats" aria-label="Cảnh báo định mức"><article className="panel"><span>Xanh · bình thường</span><strong>{counts.normal??0}</strong></article><article className="panel"><span>Vàng · gần tới hạn</span><strong>{counts.due_soon??0}</strong></article><article className="panel"><span>Đỏ · quá hạn</span><strong>{counts.overdue??0}</strong></article><article className="panel"><span>Thiếu dữ liệu giờ</span><strong>{counts.incomplete??0}</strong></article></section>
 <form method="get" className="panel requisition-filters"><input name="workspace" type="hidden" value={w}/><label>Phương tiện<select name="equipment" defaultValue={selected?.id??""}><option value="">Tất cả phương tiện</option>{equipment.data.map(row=><option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></label><label>Đến tháng–năm<input name="to" type="month" defaultValue={to} required/></label><label>Tên hoặc mã vật tư<input name="material" defaultValue={p.material??""} placeholder="Cáp, lốp, ắc quy…"/></label><button type="submit">Xác nhận bộ lọc</button></form>
 <section className="panel"><h2>{selected?selected.code:"Tất cả phương tiện"} · đến {monthLabel(to)}</h2><div className="overflow-x-auto"><table><thead><tr><th>Phương tiện</th><th>Vật tư / vị trí</th><th>Vụ việc / lượt thay gần nhất</th><th>Khoảng tháng</th><th>Giờ đã ghi nhận</th><th>Định mức / còn lại</th><th>Cảnh báo</th></tr></thead><tbody>{rows.map(row=>
 <tr className={"alert-"+row.alert_level} key={row.equipment_id+":"+row.material_id}><td><strong>{row.equipment_code}</strong></td><td>{row.material_code} · {row.material_name}<p>{row.position||"Không ghi vị trí"}</p></td><td><Link href={row.case_id?"/cases/"+row.case_id:"/equipment/"+row.equipment_code+"?workspace="+w}>{row.case_code??row.order_code}</Link><p>{dayLabel(row.performed_on)}</p></td><td><Link href={"/monthly?"+new URLSearchParams({workspace:w,kind:"hours",equipment:row.equipment_id,from:row.from_month.slice(0,7),to})}>{monthLabel(row.from_month)} → {monthLabel(to)}</Link></td><td>{formatNumber(row.recorded_hours)} h{row.missing_months>0&&<p className="text-red-800">Thiếu {row.missing_months} tháng.</p>}</td><td>{formatNumber(row.limit_hours)} / {formatNumber(row.remaining_hours)} h</td><td><strong>{alerts[row.alert_level]??row.alert_level}</strong></td></tr>)}</tbody></table></div>{!rows.length&&<p>Chưa có lượt thay phù hợp. Chỉ vật tư đã đánh dấu “Đã thay” trong vụ việc mới được tính.</p>}</section>
 {canEdit&&<section className="panel space-y-4"><div className="section-heading"><div><h2>Định mức vật tư trọng yếu</h2><p>Cáp thép, lốp, ắc quy, chốt khóa khung cẩu, công cụ xếp dỡ và vật tư khác cần kiểm soát giờ.</p></div><Link className="button button-secondary" href={"/materials?workspace="+w+"&import=materials"}>Nhập bảng mẫu vật tư</Link></div>{materials.data.filter(row=>row.service_limit_hours!==null).map(row=><MaterialLimit key={row.id+":"+row.service_limit_hours+":"+row.service_warning_hours} material={row}/>)}</section>}</>;
}
