import Link from "next/link";
import {context} from "@/lib/supabase";
import {formatNumber,monthStart} from "@/lib/domain";
import {MonthlyEntry} from "@/components/monthly-entry";
import {WorkspaceSelect} from "@/components/workspace-select";
export const dynamic="force-dynamic";
export default async function Monthly({searchParams}:{searchParams:Promise<{workspace?:string;kind?:string;month?:string}>}){
 const p=await searchParams,c=await context(p.workspace);if(!c.workspace)return <p>Chưa được cấp workspace.</p>;
 const kind=p.kind==="container"?"container":p.kind==="other"?"other":"hours";
 const w=c.workspace.id;let month:string|undefined;try{month=p.month?monthStart(p.month):undefined;}catch{return <p>Tháng không hợp lệ.</p>;}
 const [eq,cargo,metrics,other]=await Promise.all([
 c.client.from("equipment").select("id,code").eq("workspace_id",w).order("code"),
 c.client.from("cargo_types").select("code,name,unit").eq("workspace_id",w),
 c.client.from("vw_monthly_metrics").select("*").eq("workspace_id",w).order("month",{ascending:false}).limit(500),
 c.client.from("vw_other_cargo_monthly").select("*").eq("workspace_id",w).order("month",{ascending:false}).limit(500)]);
 if(eq.error || cargo.error || metrics.error || other.error)throw new Error("Không đọc được bảng tháng");
 const rows=(metrics.data??[]).filter(r=>(!month||r.month===month) && (kind==="hours"?r.operating_hours!==null:r.boxes!==null));
 const otherRows=(other.data??[]).filter(r=>!month||r.month===month);
 return <><h1>{kind==="hours"?"Tổng giờ hoạt động thực tế hàng tháng":kind==="container"?"Sản lượng container hàng tháng":"Sản lượng hàng khác hàng tháng"}</h1>
  <WorkspaceSelect workspaces={c.workspaces} selected={w}/><div className="flex flex-wrap gap-4">{(["hours","container","other"] as const).map(k=><Link className="button" key={k} href={"/monthly?workspace="+w+"&kind="+k}>{k==="hours"?"Giờ hoạt động":k==="container"?"Container (chiếc/TEU)":"Hàng khác"}</Link>)}</div>
  <p>{kind==="hours"?"Chỉ nhập giờ máy thực chạy. Giờ này làm cơ sở theo dõi định mức cáp, búa khung cẩu và bảo dưỡng; không nhập giờ dừng/hư hỏng vào bảng này.":kind==="container"?"Boxes là số chiếc container. TEU chưa có để trống; không tự quy đổi từ số chiếc.":"Hàng khác giữ đơn vị từng loại hàng, không cộng tấn với m³/chuyến hoặc TEU."}</p>
  <MonthlyEntry workspace={w} kind={kind} codes={(eq.data??[]).map(e=>e.code)} cargoCodes={(cargo.data??[]).map(r=>r.code)}/>
  {kind==="container" && <Link className="button" href={"/sheets?workspace="+w}>Cập nhật từ Google Sheets · TH</Link>}
  <section className="panel"><h2>Dữ liệu hiện có (tối đa 500 dòng gần nhất)</h2><div className="overflow-x-auto"><table><thead><tr><th>Phương tiện</th><th>Tháng</th>{kind==="hours"?<th>Tổng giờ chạy</th>:kind==="container"?<><th>Container (chiếc)</th><th>TEU</th></>:<><th>Loại hàng</th><th>Số lượng</th><th>Đơn vị</th></>}</tr></thead><tbody>
   {kind==="other"?otherRows.map((r,i)=><tr key={i}><td>{r.equipment_code}</td><td>{r.month.slice(0,7)}</td><td>{r.cargo_name}</td><td>{formatNumber(r.quantity,3)}</td><td>{r.unit}</td></tr>):
    rows.map(r=><tr key={r.equipment_id+r.month}><td>{r.equipment_code}</td><td>{r.month.slice(0,7)}</td>{kind==="hours"?<td>{formatNumber(r.operating_hours)} h</td>:<><td>{formatNumber(r.boxes,0)}</td><td>{formatNumber(r.teu)}</td></>}</tr>)}
  </tbody></table></div></section>
 </>;
}
