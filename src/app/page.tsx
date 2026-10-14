import Link from "next/link";
import {context} from "@/lib/supabase";
import {equipmentSchema} from "@/lib/domain";
import {WorkspaceSelect} from "@/components/workspace-select";
import {EquipmentList} from "@/components/equipment-list";
import {Icon,type IconName} from "@/components/icons";
import {equipmentCounts} from "@/lib/equipment-display";
export const dynamic="force-dynamic";
export default async function Home({searchParams}:{searchParams:Promise<{workspace?:string}>}){
 const params=await searchParams,c=await context(params.workspace);
 if(!c.workspace)return <><h1>Danh mục phương tiện</h1><p>Chưa được cấp không gian dữ liệu; liên hệ quản trị viên.</p></>;
 const [result,debt]=await Promise.all([
  c.client.from("equipment").select("*").eq("workspace_id",c.workspace.id).order("code"),
  c.client.from("vw_case_followup_backlog").select("*",{count:"exact"}).eq("workspace_id",c.workspace.id).limit(100),
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
 return <><section className="dashboard-hero"><div className="hero-copy"><p className="eyebrow">TV-EAM · CẢNG TÂN VŨ</p><h1>Phương tiện & công tác kỹ thuật</h1><p>Mỗi phương tiện, một lịch sử.<br/>Mỗi công việc, một tiến độ rõ ràng.</p><span className="hero-workspace"><Icon name="shield"/>{c.workspace.name}</span></div><div className="hero-art" aria-hidden="true"/></section>
  <div className="dashboard-toolbar"><div><h2>Tổng quan khu vực</h2><p className="muted">Số liệu từ dữ liệu hiện có, không phải dữ liệu mẫu.</p></div><WorkspaceSelect workspaces={c.workspaces} selected={c.workspace.id}/></div>
  <div className="stats-grid">{stats.map(s=><article className={"panel stat-card tone-"+s.tone} key={s.label}><div><p>{s.label}</p><strong>{s.value.toLocaleString("vi")}</strong><small>{s.note}</small></div><span className="stat-icon"><Icon name={s.icon}/></span></article>)}</div>
  <section className="quick-links" aria-label="Truy cập nhanh"><Link href={"/cases"+workspaceQuery}><Icon name="wrench"/><span>Vụ việc & vật tư<small>Theo dõi công việc kỹ thuật</small></span><Icon name="arrow"/></Link><Link href={"/monthly"+workspaceQuery}><Icon name="calendar"/><span>Ba bảng tháng<small>Giờ máy và sản lượng</small></span><Icon name="arrow"/></Link><Link href={"/reports"+workspaceQuery}><Icon name="chart"/><span>Báo cáo kỹ thuật<small>Tổng hợp để theo dõi</small></span><Icon name="arrow"/></Link></section>
  <div><Link className="button" href={"/catalog"+workspaceQuery}><Icon name="crane"/>Quản lý danh mục phương tiện</Link></div>
  <EquipmentList equipment={equipment.map(({id,workspace_id,code,name,status})=>({id,workspace_id,code,name,status}))}/>
  <section className="panel followup-panel"><div className="section-heading"><h2><Icon name={debt.data?.length?"layers":"check"}/>Vụ việc còn nợ trả phiếu kho</h2><span className="count-chip">{debt.count??0} vụ việc</span></div>{debt.data?.length?<><div className="followup-list">{debt.data.map(r=><p key={r.case_id}><Link href={"/cases/"+r.case_id}>{r.case_code}</Link> · {r.equipment_code} · {r.material_lines} dòng vật tư · {r.summary}</p>)}</div>{(debt.count??0)>100 && <p className="muted">Đang hiển thị 100 vụ việc đầu tiên.</p>}</>:<p className="muted">Không có vụ việc còn nợ trả phiếu trong luồng theo dõi mới.</p>}</section>
 </>;
}
