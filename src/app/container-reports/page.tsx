import {context} from "@/lib/supabase";
import {WorkspaceSelect} from "@/components/workspace-select";
import {ContainerReportModule} from "@/components/container-report-module";
import type {ContainerEquipment,ContainerReportRow} from "@/lib/container-reports";

export const dynamic="force-dynamic";
type Params={workspace?:string;year?:string;edit?:string};
export default async function ContainerReports({searchParams}:{searchParams:Promise<Params>}){
 const p=await searchParams,c=await context(p.workspace);if(!c.workspace)return <p>Chưa được cấp workspace.</p>;
 const year=/^20\d{2}$/.test(p.year??"")?Number(p.year):Number(new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric"}).format(new Date()));
 const from=`${year}-01-01`,to=`${year}-12-31`,w=c.workspace.id;
 const [equipment,reports,memberships,yearRows]=await Promise.all([
  c.client.from("equipment").select("id,code,name,category").eq("workspace_id",w).in("category",["TUKAN","QC","RTG"]).order("category").order("code"),
  c.client.from("vw_container_report_monthly").select("*").eq("workspace_id",w).gte("month",from).lte("month",to).order("month",{ascending:false}).order("equipment_code"),
  c.client.from("workspace_memberships").select("role").eq("workspace_id",w).eq("user_id",c.user.id).eq("active",true),
  c.client.from("vw_container_report_monthly").select("month").eq("workspace_id",w).limit(5000)
 ]);
 if(equipment.error||reports.error||memberships.error||yearRows.error)throw new Error("Không đọc được mô-đun báo cáo container");
 const roles=(memberships.data??[]).map(row=>row.role),isAdmin=roles.includes("QUAN_TRI_HE_THONG"),canManage=isAdmin||roles.includes("TRUONG_BO_PHAN_KY_THUAT"),canEdit=canManage||roles.includes("KY_THUAT_VIEN");
 const years=[...new Set([year,...(yearRows.data??[]).map(row=>Number(row.month.slice(0,4)))])].sort((a,b)=>b-a);
 return <>
  <header className="monthly-header"><div><p className="eyebrow">TỔNG HỢP VÀ BÁO CÁO</p><h1>Số lượng container theo tháng và năm</h1><p>Chỉ quản lý một chỉ tiêu container cho TK, QC, RTG; không trộn TEU, giờ hoạt động hay nghiệp vụ khai thác.</p></div><WorkspaceSelect workspaces={c.workspaces} selected={w}/></header>
  <ContainerReportModule workspace={w} year={year} years={years} equipment={(equipment.data??[]) as ContainerEquipment[]} rows={(reports.data??[]) as ContainerReportRow[]} editId={p.edit??""} canEdit={canEdit} canManage={canManage} isAdmin={isAdmin}/>
 </>;
}
