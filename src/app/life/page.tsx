import Link from "next/link";
import {context} from "@/lib/supabase";
import {formatNumber,localInputNow,monthStart} from "@/lib/domain";
import {defaultEndMonth,dayLabel,monthLabel} from "@/lib/monthly-hours";
import {lifeReportSchema} from "@/lib/followup";
import {WorkspaceSelect} from "@/components/workspace-select";
import {MaterialLimit} from "@/components/case-editor";
export const dynamic="force-dynamic";
const alerts:Record<string,string>={incomplete:"Thiếu giờ tháng",no_limit:"Chưa đặt định mức",overdue:"Đã tới định mức",due_soon:"Sắp tới định mức",normal:"Trong định mức"};
export default async function Life({searchParams}:{searchParams:Promise<{workspace?:string;equipment?:string;to?:string}>}){
 const p=await searchParams,c=await context(p.workspace);if(!c.workspace)return <p>Chưa có workspace.</p>;const w=c.workspace.id;
 const [equipment,materials,membership]=await Promise.all([
 c.client.from("equipment").select("id,code").eq("workspace_id",w).order("code"),c.client.from("materials").select("*").eq("workspace_id",w).order("code"),
 c.client.from("workspace_memberships").select("role").eq("workspace_id",w).eq("user_id",c.user.id).eq("active",true)]);
 if(equipment.error||materials.error||membership.error)throw new Error("Không đọc được danh mục.");
 const selected=equipment.data?.find(e=>e.id===p.equipment)??(!p.equipment?equipment.data?.[0]:undefined);
 if(!selected)return <p>Chọn phương tiện hợp lệ hoặc nhập danh mục trước.</p>;
 const current=await c.client.from("monthly_operating_hours").select("id").eq("equipment_id",selected.id).eq("month",monthStart(localInputNow().slice(0,7))).maybeSingle();
 if(current.error)throw new Error("Không đọc được giờ tháng hiện tại.");
 const to=p.to??defaultEndMonth(Boolean(current.data));let end;try{end=monthStart(to);}catch{return <p>Đến tháng–năm không hợp lệ.</p>;}
 const report=await c.client.rpc("report_material_hours",{p_equipment:selected.id,p_to:end});if(report.error)throw new Error("Không tính được giờ theo lượt thay.");
 const rows=lifeReportSchema.array().parse(report.data),canEdit=membership.data?.some(r=>r.role==="CAN_BO_VAT_TU"||r.role==="TRUONG_BO_PHAN_KY_THUAT");
 return <><h1>Giờ sử dụng từ lượt thay gần nhất</h1><WorkspaceSelect workspaces={c.workspaces} selected={w}/>
 <p>Mốc lấy từ tháng thực hiện thay trong lý lịch, tính tương đối cả tháng đó. Không nhập lại ngày thay hay số đồng hồ khi lắp.</p>
 <form method="get" className="panel grid gap-3 sm:grid-cols-2"><input name="workspace" type="hidden" value={w}/>
 <label>Phương tiện<select name="equipment" defaultValue={selected.id}>{equipment.data?.map(e=><option key={e.id} value={e.id}>{e.code}</option>)}</select></label>
 <label>Đến tháng–năm<input name="to" type="month" defaultValue={to} required/></label><button type="submit">Lọc & tính giờ</button></form>
 <section className="panel"><h2>{selected.code} · đến {monthLabel(to)}</h2><div className="overflow-x-auto"><table><thead><tr><th>Vật tư / vị trí</th><th>Vụ việc / lượt thay gần nhất</th><th>Khoảng tháng</th><th>Giờ đã ghi nhận</th><th>Định mức / còn lại</th><th>Kiểm tra</th></tr></thead><tbody>{rows.map(r=>
 <tr key={r.material_id}><td>{r.material_code} · {r.material_name}<p>{r.position||"Không ghi vị trí"}</p></td>
 <td><Link href={r.case_id?"/cases/"+r.case_id:"/equipment/"+selected.code+"?workspace="+w}>{r.case_code??r.order_code}</Link><p>{dayLabel(r.performed_on)}</p></td>
 <td><Link href={"/monthly?"+new URLSearchParams({workspace:w,kind:"hours",equipment:selected.id,from:r.from_month.slice(0,7),to})}>{monthLabel(r.from_month)} → {monthLabel(to)}</Link></td>
 <td>{formatNumber(r.recorded_hours)} h{r.missing_months>0&&<p className="text-red-800">Thiếu {r.missing_months} tháng; tổng chưa đầy đủ.</p>}</td>
 <td>{formatNumber(r.limit_hours)} / {formatNumber(r.remaining_hours)} h</td><td>{alerts[r.alert_level]??r.alert_level}</td></tr>)}</tbody></table></div>
 {!rows.length&&<p>Chưa có lượt thay được ghi nhận đến tháng đã chọn. Vật tư mới vay/lĩnh chưa được tính là đã thay.</p>}</section>
 {canEdit&&<section className="panel space-y-4"><h2>Định mức vật tư theo giờ hoạt động</h2><p>Áp dụng cho cáp, búa hoặc vật tư khác cần theo dõi giờ.</p>{materials.data?.map(m=><MaterialLimit key={m.id+":"+m.service_limit_hours+":"+m.service_warning_hours} material={m}/>)}</section>}</>;
}
