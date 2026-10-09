import {context} from "@/lib/supabase";
import {formatNumber} from "@/lib/domain";
import {WorkspaceSelect} from "@/components/workspace-select";
import {LifeEntry} from "@/components/life-entry";
export const dynamic="force-dynamic";
export default async function Life({searchParams}:{searchParams:Promise<{workspace?:string}>}){
 const p=await searchParams,c=await context(p.workspace);if(!c.workspace)return <p>Chưa có workspace.</p>;const w=c.workspace.id;
 const [life,pm,equipment]=await Promise.all([
  c.client.from("vw_component_life").select("*").eq("workspace_id",w),c.client.from("vw_maintenance_due").select("*").eq("workspace_id",w),
  c.client.from("equipment").select("id,code").eq("workspace_id",w).order("code")]);
 if(life.error || pm.error || equipment.error)throw new Error("Không đọc được định mức");
 return <><h1>Định mức theo giờ hoạt động & bảo dưỡng</h1><WorkspaceSelect workspaces={c.workspaces} selected={w}/>
  <p>Giờ đã dùng = giờ lũy kế phương tiện − giờ đồng hồ khi lắp. Sửa giờ tháng tự cập nhật các mốc này.</p>
  <section className="panel"><h2>Cáp / búa khung cẩu / bộ phận</h2><div className="overflow-x-auto"><table><thead><tr><th>PTTB</th><th>Bộ phận</th><th>Giờ khi lắp</th><th>Đã dùng (h)</th><th>Định mức (h)</th><th>Còn lại (h)</th><th>Cảnh báo</th></tr></thead><tbody>{(life.data??[]).map(r=><tr key={r.id}><td>{r.equipment_code}</td><td>{r.name} · {r.slot_code}</td><td>{formatNumber(r.installed_meter_hours)}</td><td>{formatNumber(r.used_hours)}</td><td>{formatNumber(r.limit_hours)}</td><td>{formatNumber(r.remaining_hours)}</td><td>{r.alert_level==="normal"?"Bình thường":r.alert_level==="due_soon"?"Sắp tới định mức":r.alert_level==="overdue"?"Đã tới định mức":"Cần đối chiếu số đồng hồ"}</td></tr>)}</tbody></table></div></section>
  <section className="panel"><h2>Kế hoạch bảo dưỡng định kỳ</h2>{(pm.data??[]).map((r,i)=><p key={i}>{r.equipment_code} · {r.name}: mốc {formatNumber(r.due_hours)} h / {r.due_date??"—"} · {r.alert_level}</p>)}</section>
  <LifeEntry equipment={equipment.data??[]}/>
 </>;
}
