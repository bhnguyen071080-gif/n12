import Link from "next/link";
import {context} from "@/lib/supabase";
import {formatNumber,monthStart,localInputNow} from "@/lib/domain";
import {defaultEndMonth,hourRow,inclusiveRange,monthLabel,summarizeHours} from "@/lib/monthly-hours";
import {z} from "zod";
import {MonthlyEntry} from "@/components/monthly-entry";
import {WorkspaceSelect} from "@/components/workspace-select";
import {OperatingBaseline} from "@/components/operating-baseline";
import {cargoUnitLabels} from "@/lib/table-import";
import {canImportTable} from "@/lib/import-placement";
import {TableImportPanel} from "@/components/table-import-panel";
import {MonthlyOverview} from "@/components/monthly-overview";
import {SheetEntry} from "@/components/sheet-entry";
import {MonthlySavedRecords,type MonthlySavedRecord} from "@/components/monthly-saved-records";
import type {MonthlyActivity} from "@/lib/monthly-overview";

export const dynamic="force-dynamic";
type Params={workspace?:string;kind?:string;equipment?:string;from?:string;to?:string;group?:string;import?:string;editEquipment?:string;editMonth?:string;editValue?:string};
type SheetSource={id:string;name:string;source_kind:"container"|"hours"};

export default async function Monthly({searchParams}:{searchParams:Promise<Params>}){
 const p=await searchParams,c=await context(p.workspace);if(!c.workspace)return <p>Chưa được cấp workspace.</p>;
 const kind=p.kind==="container"?"container":p.kind==="other"?"other":"hours",w=c.workspace.id;
 const [eq,cargo,metrics,other,memberships]=await Promise.all([
  c.client.from("equipment").select("id,code,category,initial_hours,accumulated_hours,hours_start_month").eq("workspace_id",w).order("code"),
  c.client.from("cargo_types").select("code,name,unit").eq("workspace_id",w),
  c.client.from("vw_monthly_activity").select("*").eq("workspace_id",w).order("month",{ascending:false}).limit(500),
  c.client.from("vw_other_cargo_monthly").select("*").eq("workspace_id",w).order("month",{ascending:false}).limit(500),
  c.client.from("workspace_memberships").select("role").eq("workspace_id",w).eq("user_id",c.user.id).eq("active",true)
 ]);
 if(eq.error||cargo.error||metrics.error||other.error||memberships.error)throw new Error("Không đọc được bảng theo dõi tháng");
 const canConfirm=memberships.data.some(row=>row.role==="TRUONG_BO_PHAN_KY_THUAT"),roles=memberships.data.map(row=>row.role),selectedGroup=p.group??"";
 const filteredEquipment=(eq.data??[]).filter(row=>!selectedGroup||row.category===selectedGroup);
 const selected=filteredEquipment.find(row=>row.id===p.equipment)??filteredEquipment[0]??eq.data?.[0];
 if(p.equipment&&!(eq.data??[]).some(row=>row.id===p.equipment))return <p>Phương tiện không hợp lệ hoặc chưa có quyền.</p>;

 let from=localInputNow().slice(0,4)+"-01",to=localInputNow().slice(0,7),hours:z.infer<typeof hourRow>[]=[],activityRows:MonthlyActivity[]=[];
 if(kind==="hours"&&selected){
  const current=await c.client.from("monthly_operating_hours").select("id").eq("equipment_id",selected.id).eq("month",monthStart(localInputNow().slice(0,7))).maybeSingle();
  if(current.error)throw new Error("Không đọc được giờ tháng hiện tại.");
  to=p.to??defaultEndMonth(Boolean(current.data));from=p.from??(selected.hours_start_month&&selected.hours_start_month.slice(0,7)<=to?selected.hours_start_month.slice(0,7):to.slice(0,4)+"-01");
  let bounds;try{bounds=inclusiveRange(from,to);}catch{return <p>Khoảng tháng không hợp lệ.</p>;}
  const detail=await c.client.rpc("report_operating_hours",{p_equipment:selected.id,p_from:bounds.from,p_to:bounds.to});
  if(detail.error)throw new Error("Không tổng hợp được giờ tháng.");hours=hourRow.array().parse(detail.data);
  for(let offset=0;;offset+=1000){
   const activity=await c.client.from("vw_monthly_activity").select("equipment_id,equipment_code,month,operating_hours,boxes").eq("workspace_id",w).gte("month",bounds.from).lte("month",bounds.to).order("equipment_code").order("month").range(offset,offset+999);
   if(activity.error)throw new Error("Không đọc được bảng tổng thể.");
   const page=activity.data??[];activityRows.push(...page.map(row=>({...row,operating_hours:row.operating_hours===null?null:Number(row.operating_hours),boxes:row.boxes===null?null:Number(row.boxes)})));if(page.length<1000)break;
  }
 }
 const summary=summarizeHours(hours);
 let sheetSources:SheetSource[]=[],syncRuns:{id:string;source_id:string;row_count:number;created_at:string}[]=[];
 if(kind!=="other"){
  const [sources,runs]=await Promise.all([c.client.from("sheet_sources").select("id,name,source_kind").eq("workspace_id",w).eq("source_kind",kind),c.client.from("sheet_sync_runs").select("id,source_id,row_count,created_at").eq("workspace_id",w).order("created_at",{ascending:false}).limit(5)]);
  if(!sources.error)sheetSources=(sources.data??[]).filter((row):row is SheetSource=>row.source_kind==="hours"||row.source_kind==="container");
  if(!runs.error)syncRuns=runs.data??[];
 }
 const editCode=(eq.data??[]).some(row=>row.code===p.editEquipment)?p.editEquipment:"",editMonth=/^\d{4}-\d{2}$/.test(p.editMonth??"")?p.editMonth:"",parsedValue=Number(p.editValue),editValue=p.editValue!==undefined&&Number.isFinite(parsedValue)&&parsedValue>=0?parsedValue:undefined;
 const rows=(metrics.data??[]).filter(row=>kind==="hours"?row.operating_hours!==null:row.boxes!==null),otherRows=other.data??[];
 const title=kind==="hours"?"Giờ hoạt động":kind==="container"?"Sản lượng container":"Sản lượng hàng khác";
 const savedRows:MonthlySavedRecord[]=kind==="container"?rows.map(row=>({id:`${row.equipment_id}:${row.month}`,equipmentCode:row.equipment_code,month:row.month,boxes:row.boxes===null?null:Number(row.boxes)})):otherRows.map((row,index)=>({id:`${row.equipment_code}:${row.month}:${row.cargo_name}:${index}`,equipmentCode:row.equipment_code,month:row.month,cargoName:row.cargo_name,quantity:Number(row.quantity),unit:row.unit}));
 return <>
  <header className="monthly-header"><div><p className="eyebrow">DỮ LIỆU VẬN HÀNH</p><h1>Kiểm soát giờ hoạt động & sản lượng</h1><p>Tập trung tra cứu, bổ sung tháng còn thiếu, đồng bộ nguồn và xuất báo cáo trong một màn hình.</p></div><WorkspaceSelect workspaces={c.workspaces} selected={w}/></header>
  <nav className="monthly-kind-tabs" aria-label="Loại dữ liệu tháng">{(["hours","container","other"] as const).map(value=><Link aria-current={kind===value?"page":undefined} key={value} href={`/monthly?${new URLSearchParams({workspace:w,kind:value})}`}>{value==="hours"?"Giờ hoạt động":value==="container"?"Container":"Hàng khác"}</Link>)}</nav>
  <div className="data-workbench monthly-workbench">
   <div className="data-workbench-entry space-y-5">
  <section className="panel monthly-filter-panel"><div className="section-heading"><div><p className="eyebrow">BỘ LỌC CHUNG</p><h2>{title}</h2></div><span className="count-chip">Không lưu ngày đầu/cuối riêng; hệ thống tự hiểu theo tháng</span></div>
   {kind==="hours"&&selected?<form method="get" className="monthly-filter-grid"><input name="workspace" type="hidden" value={w}/><input name="kind" type="hidden" value="hours"/>
    <label>Nhóm phương tiện<select name="group" defaultValue={selectedGroup}><option value="">Tất cả phương tiện</option>{[...new Set((eq.data??[]).map(row=>row.category))].map(category=><option key={category} value={category}>{category}</option>)}</select></label>
    <label>Phương tiện đối chiếu<select name="equipment" defaultValue={selected.id}>{filteredEquipment.map(row=><option key={row.id} value={row.id}>{row.code}</option>)}</select></label>
    <label>Từ tháng<input name="from" type="month" defaultValue={from} required/></label><label>Đến tháng<input name="to" type="month" defaultValue={to} required/></label><button type="submit">Áp dụng bộ lọc</button>
   </form>:<p className="muted">Chọn loại dữ liệu phía trên; bảng chỉ hiển thị đúng đơn vị của từng loại, không cộng lẫn giờ, chiếc, tấn hay m³.</p>}
   {kind==="hours"&&<div className="monthly-export-actions"><Link className="button button-secondary" href={`/api/monthly/export?${new URLSearchParams({workspace:w,from,to,group:selectedGroup,format:"xlsx"})}`}>Xuất Excel</Link><Link className="button button-secondary" href={`/api/monthly/export?${new URLSearchParams({workspace:w,from,to,group:selectedGroup,format:"pdf"})}`}>Xuất PDF</Link><Link className="button button-secondary" href={`/api/monthly/export?${new URLSearchParams({workspace:w,from,to,group:selectedGroup,format:"csv"})}`}>Mở bằng Google Sheets</Link></div>}
  </section>
  <section className="panel monthly-tools" id="cong-cu-du-lieu"><div className="section-heading"><div><p className="eyebrow">CÔNG CỤ DỮ LIỆU</p><h2>Nhập, điều chỉnh và đồng bộ tại một nơi</h2></div><span className="count-chip">{title}</span></div>
   {eq.data?.length?<MonthlyEntry key={`${kind}:${editCode}:${editMonth}:${editValue??""}`} workspace={w} kind={kind} codes={eq.data.map(row=>row.code)} cargoCodes={(cargo.data??[]).map(row=>row.code)} initialCode={editCode} initialMonth={editMonth} initialValue={editValue}/>:<p>Chưa có phương tiện. <Link href={`/catalog?workspace=${w}`}>Mở danh mục phương tiện</Link> để khai báo trước.</p>}
   <div className="monthly-tool-accordions"><details open={p.import===kind}><summary>Nhập nhiều dòng từ Excel/CSV</summary><TableImportPanel workspace={w} kind={kind} canImport={canImportTable(roles,kind)} defaultOpen={p.import===kind}/></details>
   {kind==="other"&&<details><summary>Cập nhật danh mục loại hàng</summary><TableImportPanel workspace={w} kind="cargo" canImport={canImportTable(roles,"cargo")}/></details>}
   {kind!=="other"&&<details><summary>Đồng bộ Google Sheets</summary><SheetEntry workspace={w} sources={sheetSources}/>{syncRuns.length>0&&<div className="monthly-sync-history"><strong>5 lần cập nhật gần nhất</strong>{syncRuns.map(run=><span key={run.id}>{new Date(run.created_at).toLocaleString("vi-VN",{timeZone:"Asia/Bangkok"})} · {run.row_count} dòng</span>)}</div>}</details>}
   {kind==="hours"&&selected&&<details><summary>Thiết lập giờ gốc của phương tiện</summary><OperatingBaseline key={selected.id+":"+(selected.hours_start_month??"pending")} equipment={selected.id} code={selected.code} hours={selected.initial_hours} start={selected.hours_start_month??null} accumulated={selected.accumulated_hours} canConfirm={canConfirm}/></details>}</div>
  </section>
   </div>
   <div className="monthly-results-scroll">
    {kind==="hours"&&selected&&<MonthlyOverview workspace={w} equipment={filteredEquipment} activity={activityRows} from={from} to={to} group={selectedGroup}/>} 
    {kind==="hours"&&selected&&<details className="panel monthly-detail"><summary>Đối chiếu chi tiết {selected.code}: {monthLabel(from)} → {monthLabel(to)}</summary><p className="monthly-detail-total">Đã ghi nhận <strong>{formatNumber(summary.total)} h</strong>{summary.missing.length?` · thiếu ${summary.missing.length} tháng`:" · đủ dữ liệu trong kỳ"}</p><div className="overflow-x-auto"><table className="compact-table"><thead><tr><th>Phương tiện</th><th>Tháng</th><th>Giờ hoạt động</th><th>Tác vụ</th></tr></thead><tbody>{hours.map(row=><tr key={row.month}><td>{selected.code}</td><td>{monthLabel(row.month)}</td><td>{row.operating_hours===null?"Chưa nhập":formatNumber(row.operating_hours)+" h"}</td><td><Link href={`/monthly?${new URLSearchParams({workspace:w,kind:"hours",equipment:selected.id,from,to,group:selectedGroup,editEquipment:selected.code,editMonth:row.month.slice(0,7),...(row.operating_hours===null?{}:{editValue:String(row.operating_hours)})})}#cap-nhat-thang`}>{row.operating_hours===null?"Bổ sung":"Điều chỉnh"}</Link></td></tr>)}</tbody></table></div></details>}
    {kind!=="hours"&&<MonthlySavedRecords title={title} kind={kind} rows={savedRows} unitLabels={cargoUnitLabels}/>} 
   </div>
  </div>
 </>;
}

