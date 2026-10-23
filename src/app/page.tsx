import Link from "next/link";
import {context} from "@/lib/supabase";
import {equipmentSchema,formatNumber,localInputNow,monthStart} from "@/lib/domain";
import {WorkspaceSelect} from "@/components/workspace-select";
import {EquipmentList} from "@/components/equipment-list";
import {Icon,type IconName} from "@/components/icons";
import {equipmentCounts} from "@/lib/equipment-display";
export const dynamic="force-dynamic";
export default async function Home({searchParams}:{searchParams:Promise<{workspace?:string}>}){
 const params=await searchParams,c=await context(params.workspace);
 if(!c.workspace)return <><h1>Danh mục phương tiện</h1><p>Chưa được cấp không gian dữ liệu; liên hệ quản trị viên.</p></>;
 const [result,debt,materialAlerts]=await Promise.all([
  c.client.from("equipment").select("*").eq("workspace_id",c.workspace.id).order("code"),
  c.client.from("vw_case_followup_backlog").select("*",{count:"exact"}).eq("workspace_id",c.workspace.id).limit(100),
  c.client.rpc("report_workspace_material_hours",{p_workspace:c.workspace.id,p_to:monthStart(localInputNow().slice(0,7))}),
 ]);
 if(result.error)throw new Error("Không đọc được PTTB");
 if(debt.error)throw new Error("Không đọc được cảnh báo trả phiếu.");
 const equipment=equipmentSchema.array().parse(result.data);
 const counts=equipmentCounts(equipment);
 const stats:{label:string;value:number;note:string;icon:IconName;tone:string}[]=[
  {label:"Tổng phương tiện",value:counts.total,note:"Trong khu vực đang chọn",icon:"crane",tone:"blue"},
  {label:"Đang khai thác",value:counts.available,note:"Theo trạng thái đã ghi nhận",icon:"check",tone:"green"},
  {label:"Sửa chữa / bảo dưỡng",value:counts.repair,note:"Theo trạng thái đã ghi nhận",icon:"wrench",tone:"orange"},
  {label:"Vụ việc nợ trả phiếu",value:debt.count??0,note:"Trong luồng theo dõi mới",icon:"layers",tone:"violet"},
 ];
 const workspaceQuery="?workspace="+c.workspace.id;
 const importantAlerts=(materialAlerts.data??[]).filter(row=>row.alert_level==="overdue"||row.alert_level==="due_soon");
 const alertExamples=[
  {level:"normal",label:"Xanh · bình thường",equipment:"QC05",material:"Cáp thép nâng hàng",used:"1.520 h",remaining:"480 h"},
  {level:"due_soon",label:"Vàng · gần tới hạn",equipment:"RTG12",material:"Lốp di chuyển",used:"1.900 h",remaining:"100 h"},
  {level:"overdue",label:"Đỏ · quá hạn",equipment:"TUKAN12",material:"Ắc quy khởi động",used:"2.150 h",remaining:"-150 h"},
 ];
 return <><section className="dashboard-hero"><div className="hero-copy"><p className="eyebrow">TV-EAM · CẢNG TÂN VŨ</p><h1>Phương tiện & công tác kỹ thuật</h1><p>Mỗi phương tiện, một lịch sử.<br/>Mỗi công việc, một tiến độ rõ ràng.</p><span className="hero-workspace"><Icon name="shield"/>{c.workspace.name}</span></div><div className="hero-art" aria-hidden="true"/></section>
  <section className="panel overview-compact"><div className="overview-title"><h2>Tổng quan khu vực</h2><p className="muted">Số liệu thực tế</p></div><div className="overview-metrics">{stats.map(s=><article className={"overview-metric tone-"+s.tone} key={s.label}><span className="stat-icon"><Icon name={s.icon}/></span><div><strong>{s.value.toLocaleString("vi")}</strong><p>{s.label}</p></div></article>)}</div><WorkspaceSelect workspaces={c.workspaces} selected={c.workspace.id}/></section>
  <section className="quick-links" aria-label="Truy cập nhanh"><Link href={"/cases"+workspaceQuery}><Icon name="wrench"/><span>Vụ việc & lý lịch<small>Theo dõi công việc kỹ thuật</small></span><Icon name="arrow"/></Link><Link href={"/monthly"+workspaceQuery}><Icon name="calendar"/><span>Giám sát giờ & sản lượng<small>Giờ gốc, giờ tháng và sản lượng</small></span><Icon name="arrow"/></Link><Link href={"/reports"+workspaceQuery}><Icon name="chart"/><span>Báo cáo kỹ thuật<small>Tổng hợp để theo dõi</small></span><Icon name="arrow"/></Link></section>
  <div><Link className="button" href={"/catalog"+workspaceQuery}><Icon name="crane"/>Quản lý danh mục phương tiện</Link></div>
  <EquipmentList equipment={equipment.map(({id,workspace_id,code,name,category,status,serial_number,manufacture_year,accumulated_hours})=>({id,workspace_id,code,name,category,status,serial_number,manufacture_year,accumulated_hours}))}/>
  {!materialAlerts.error&&<section className="panel material-alert-preview"><div className="section-heading"><div><h2><Icon name="clock"/>Cảnh báo vật tư theo định mức</h2><p className="muted">Hiển thị khi bắt đầu làm việc</p></div><Link href={"/life"+workspaceQuery}>Mở bảng đầy đủ</Link></div>{importantAlerts.length?<div className="overflow-x-auto"><table><thead><tr><th>Mức</th><th>Phương tiện</th><th>Vật tư</th><th>Giờ đã dùng</th><th>Còn lại</th></tr></thead><tbody>{importantAlerts.slice(0,12).map(row=><tr className={"alert-"+row.alert_level} key={row.equipment_id+":"+row.material_id}><td>{row.alert_level==="overdue"?"Đỏ · quá hạn":"Vàng · gần tới hạn"}</td><td>{row.equipment_code}</td><td>{row.material_code} · {row.material_name}</td><td>{formatNumber(row.recorded_hours)} h</td><td>{formatNumber(row.remaining_hours)} h</td></tr>)}</tbody></table></div>:<p className="plan-ok">Hiện không có vật tư ở mức vàng hoặc đỏ.</p>}<details className="alert-demo"><summary>Xem ví dụ màu cảnh báo</summary><p>Ví dụ minh họa giao diện, không được lưu vào dữ liệu thực tế.</p><div className="overflow-x-auto"><table><thead><tr><th>Mức</th><th>Phương tiện</th><th>Vật tư trọng yếu</th><th>Giờ đã dùng</th><th>Còn lại</th></tr></thead><tbody>{alertExamples.map(row=><tr className={"alert-"+row.level} key={row.level}><td>{row.label}</td><td>{row.equipment}</td><td>{row.material}</td><td>{row.used}</td><td>{row.remaining}</td></tr>)}</tbody></table></div></details></section>}
  <section className="panel followup-panel"><div className="section-heading"><h2><Icon name={debt.data?.length?"layers":"check"}/>Vụ việc còn nợ trả phiếu kho</h2><span className="count-chip">{debt.count??0} vụ việc</span></div>{debt.data?.length?<><div className="followup-list">{debt.data.map(r=><p key={r.case_id}><Link href={"/cases/"+r.case_id}>{r.case_code}</Link> · {r.equipment_code} · {r.material_lines} dòng vật tư · {r.summary}</p>)}</div>{(debt.count??0)>100 && <p className="muted">Đang hiển thị 100 vụ việc đầu tiên.</p>}</>:<p className="muted">Không có vụ việc còn nợ trả phiếu trong luồng theo dõi mới.</p>}</section>
 </>;
}

