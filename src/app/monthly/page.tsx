import Link from "next/link";
import {context} from "@/lib/supabase";
import {formatNumber,monthStart,localInputNow} from "@/lib/domain";
import {defaultEndMonth,hourRow,inclusiveRange,monthLabel,summarizeHours} from "@/lib/monthly-hours";
import {z} from "zod";
import {MonthlyEntry} from "@/components/monthly-entry";
import {WorkspaceSelect} from "@/components/workspace-select";
import {OperatingBaseline} from "@/components/operating-baseline";
import {cargoUnitLabels} from "@/lib/table-import";
export const dynamic="force-dynamic";
export default async function Monthly({searchParams}:{searchParams:Promise<{workspace?:string;kind?:string;month?:string;equipment?:string;from?:string;to?:string}>}){
 const p=await searchParams,c=await context(p.workspace);if(!c.workspace)return <p>Chưa được cấp workspace.</p>;
 const kind=p.kind==="container"?"container":p.kind==="other"?"other":"hours";
 const w=c.workspace.id;let month:string|undefined;try{month=p.month?monthStart(p.month):undefined;}catch{return <p>Tháng không hợp lệ.</p>;}
 const [eq,cargo,metrics,other,memberships]=await Promise.all([
 c.client.from("equipment").select("id,code,initial_hours,accumulated_hours,hours_start_month").eq("workspace_id",w).order("code"),
 c.client.from("cargo_types").select("code,name,unit").eq("workspace_id",w),
 c.client.from("vw_monthly_activity").select("*").eq("workspace_id",w).order("month",{ascending:false}).limit(500),
 c.client.from("vw_other_cargo_monthly").select("*").eq("workspace_id",w).order("month",{ascending:false}).limit(500),
 c.client.from("workspace_memberships").select("role").eq("workspace_id",w).eq("user_id",c.user.id).eq("active",true)]);
 if(eq.error || cargo.error || metrics.error || other.error || memberships.error)throw new Error("Không đọc được bảng tháng");
 const canConfirm=memberships.data.some(r=>r.role==="TRUONG_BO_PHAN_KY_THUAT");
 const selected=eq.data?.find(e=>e.id===p.equipment)??(!p.equipment?eq.data?.[0]:undefined);
 if(p.equipment&&!selected)return <p>Phương tiện không hợp lệ hoặc chưa có quyền.</p>;
 let from="",to="",hours:z.infer<typeof hourRow>[]=[];
 if(kind==="hours"&&selected){
  const current=await c.client.from("monthly_operating_hours").select("id").eq("equipment_id",selected.id).eq("month",monthStart(localInputNow().slice(0,7))).maybeSingle();
  if(current.error)throw new Error("Không đọc được giờ tháng hiện tại.");
  to=p.to??defaultEndMonth(Boolean(current.data));from=p.from??(selected.hours_start_month && selected.hours_start_month.slice(0,7)<=to?selected.hours_start_month.slice(0,7):to.slice(0,4)+"-01");
  let bounds;try{bounds=inclusiveRange(from,to);}catch{return <p>Khoảng tháng không hợp lệ.</p>;}
  const r=await c.client.rpc("report_operating_hours",{p_equipment:selected.id,p_from:bounds.from,p_to:bounds.to});
  if(r.error)throw new Error("Không tổng hợp được giờ tháng.");hours=hourRow.array().parse(r.data);
 }
 const summary=summarizeHours(hours);
 const rows=(metrics.data??[]).filter(r=>(!month||r.month===month) && (kind==="hours"?r.operating_hours!==null:r.boxes!==null));
 const otherRows=(other.data??[]).filter(r=>!month||r.month===month);
 return <><h1>{kind==="hours"?"Giám sát giờ hoạt động":kind==="container"?"Sản lượng container hàng tháng":"Sản lượng hàng khác hàng tháng"}</h1>
  <WorkspaceSelect workspaces={c.workspaces} selected={w}/><div className="flex flex-wrap gap-4">{(["hours","container","other"] as const).map(k=><Link className="button" key={k} href={"/monthly?workspace="+w+"&kind="+k}>{k==="hours"?"Giờ hoạt động":k==="container"?"Container (chiếc)":"Hàng khác"}</Link>)}</div>
  <p>{kind==="hours"?"Chỉ nhập giờ máy thực chạy. Giờ này làm cơ sở theo dõi định mức cáp, búa khung cẩu và bảo dưỡng; không nhập giờ dừng/hư hỏng vào bảng này.":kind==="container"?"Chỉ ghi nhận số container (chiếc) của phương tiện trong tháng.":"Hàng khác giữ đơn vị từng loại hàng, không cộng tấn với m³/chuyến hoặc số container."}</p>
  <div className="flex flex-wrap gap-3"><Link className="button" href={"/imports?workspace="+w+"&kind="+kind}>Nhập số liệu tháng từ tệp</Link><a className="button button-secondary" href="/api/import-template">Tải bộ mẫu Excel</a>{kind==="other"&&<Link className="button button-secondary" href={"/materials?workspace="+w}>Danh mục loại hàng và đơn vị</Link>}</div>
  {kind==="hours"&&selected&&<section className="panel"><h2>Lọc tổng giờ theo khoảng tháng</h2>
   <form method="get" className="grid gap-3 sm:grid-cols-3"><input name="workspace" type="hidden" value={w}/><input name="kind" type="hidden" value="hours"/>
   <label>Phương tiện<select name="equipment" defaultValue={selected.id}>{eq.data?.map(e=><option key={e.id} value={e.id}>{e.code}</option>)}</select></label>
   <label>Từ tháng–năm<input name="from" type="month" defaultValue={from} required/></label><label>Đến tháng–năm<input name="to" type="month" defaultValue={to} required/></label><button type="submit">Lọc & tính tổng</button></form>
   <p>Tính cả tháng đầu và cuối. Chọn đến tháng–năm thủ công; mặc định tháng hiện tại nếu phương tiện đã có dữ liệu, nếu chưa có thì tháng liền trước.</p></section>}
  {kind==="hours"&&selected&&<OperatingBaseline key={selected.id+":"+(selected.hours_start_month??"pending")} equipment={selected.id} code={selected.code} hours={selected.initial_hours} start={selected.hours_start_month??null} accumulated={selected.accumulated_hours} canConfirm={canConfirm}/>}
  {kind==="hours"&&selected&&<section className="panel"><h2>Giờ chạy theo khoảng đã chọn</h2>
   <p className="text-xl font-bold">{selected.code} · {monthLabel(from)} → {monthLabel(to)}: {formatNumber(summary.total)} h đã ghi nhận</p>
   {summary.missing.length>0&&<p role="alert" className="text-red-800">Thiếu {summary.missing.length} tháng: {summary.missing.map(monthLabel).join(", ")}. Tổng chưa đầy đủ; không coi tháng thiếu là 0 giờ.</p>}
   <div className="overflow-x-auto"><table><thead><tr><th>Phương tiện</th><th>Tháng–năm</th><th>Giờ hoạt động</th></tr></thead><tbody>{hours.map(r=><tr key={r.month}><td>{selected.code}</td><td>{monthLabel(r.month)}</td><td>{r.operating_hours===null?"Thiếu dữ liệu":formatNumber(r.operating_hours)+" h"}</td></tr>)}</tbody></table></div></section>}
  {eq.data?.length?<MonthlyEntry workspace={w} kind={kind} codes={eq.data.map(e=>e.code)} cargoCodes={(cargo.data??[]).map(r=>r.code)}/>:<section className="panel"><h2>Chưa có phương tiện</h2><p>Khai báo phương tiện trước, sau đó đối chiếu giờ gốc và ghi nhận giờ chạy tại đây.</p><Link className="button" href={"/catalog?workspace="+w}>Mở danh mục phương tiện</Link></section>}
  {kind!=="other" && <Link className="button" href={"/sheets?workspace="+w}>Cập nhật từ Google Sheets · TH</Link>}
  <section className="panel"><h2>Dữ liệu hiện có (tối đa 500 dòng gần nhất)</h2><div className="overflow-x-auto"><table><thead><tr><th>Phương tiện</th><th>Tháng</th>{kind==="hours"?<th>Tổng giờ chạy</th>:kind==="container"?<th>Container (chiếc)</th>:<><th>Loại hàng</th><th>Số lượng</th><th>Đơn vị</th></>}</tr></thead><tbody>
   {kind==="other"?otherRows.map((r,i)=><tr key={i}><td>{r.equipment_code}</td><td>{r.month.slice(0,7)}</td><td>{r.cargo_name}</td><td>{formatNumber(r.quantity,3)}</td><td>{cargoUnitLabels[r.unit]??r.unit}</td></tr>):
    rows.map(r=><tr key={r.equipment_id+r.month}><td>{r.equipment_code}</td><td>{r.month.slice(0,7)}</td>{kind==="hours"?<td>{formatNumber(r.operating_hours)} h</td>:<td>{formatNumber(r.boxes,0)}</td>}</tr>)}
  </tbody></table></div></section>
 </>;
}
