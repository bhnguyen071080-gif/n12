import Link from "next/link";
import {context} from "@/lib/supabase";
import {causeLabels,causeSchema,costSchema,formatNumber,localInputNow,period,progressLabels,reliabilitySchema} from "@/lib/domain";
import {WorkspaceSelect} from "@/components/workspace-select";
export const dynamic="force-dynamic";
export default async function Reports({searchParams}:{searchParams:Promise<{workspace?:string;from?:string;to?:string}>}){
 const p=await searchParams,c=await context(p.workspace);if(!c.workspace)return <p>Chưa có workspace.</p>;
 const to=p.to??localInputNow().slice(0,7);let from:string,span:{from:string;to:string};
 try{const fallback=new Date(to+"-01T00:00:00Z");fallback.setUTCMonth(fallback.getUTCMonth()-1);from=p.from??fallback.toISOString().slice(0,7);span=period(from,to);}catch{return <p>Kỳ báo cáo không hợp lệ; chọn 1–36 tháng, kết thúc không bao gồm tháng đó.</p>;}
 const w=c.workspace.id,args={p_workspace:w,p_from:span.from,p_to:span.to};
 const [reliability,costs,causes,tech,paper]=await Promise.all([
  c.client.rpc("report_reliability",args),c.client.rpc("report_material_costs",args),c.client.rpc("report_failure_causes",args),
  c.client.from("vw_technical_backlog").select("*").eq("workspace_id",w),
  c.client.from("vw_procedural_backlog").select("*").eq("workspace_id",w)]);
 if(reliability.error || costs.error || causes.error || tech.error || paper.error)return <section className="panel"><h1>Báo cáo kỹ thuật</h1><p>Chưa có quyền hoặc cơ sở dữ liệu chưa áp dụng migration Giai đoạn 3. Vai trò kỹ thuật viên/trưởng bộ phận mới xem được báo cáo đầy đủ.</p></section>;
 const rr=reliabilitySchema.array().parse(reliability.data),cc=costSchema.array().parse(costs.data),ca=causeSchema.array().parse(causes.data);
 const exportUrl="/api/reports/export?workspace="+w+"&from="+from+"&to="+to;
 return <><h1>Báo cáo phân tích kỹ thuật</h1><WorkspaceSelect workspaces={c.workspaces} selected={w}/>
  <form method="get" className="panel flex flex-wrap items-end gap-4"><input type="hidden" name="workspace" value={w}/>
   <label>Từ tháng<input type="month" name="from" defaultValue={from} required/></label><label>Đến tháng (loại trừ)<input type="month" name="to" defaultValue={to} required/></label><button>Xem kỳ tháng / quý</button><Link className="button" href={exportUrl}>Xuất CSV</Link></form>
  <p>H = giờ máy thực chạy; D = giờ dừng sự cố đã xác nhận; N = số sự cố bắt đầu trong kỳ. MTBF = H/N, MTTR = D/N, Availability = H/(H+D). Không trừ giờ dừng thêm khỏi H.</p>
  <section className="panel"><h2>Dừng máy & độ tin cậy</h2><div className="overflow-x-auto"><table><thead><tr><th>PTTB</th><th>Giờ chạy</th><th>Giờ dừng sự cố</th><th>Sự cố</th><th>MTTR (h)</th><th>MTBF (h)</th><th>Sẵn sàng (%)</th><th>Chất lượng số liệu</th></tr></thead><tbody>
   {rr.map(r=><tr key={r.equipment_id}><td>{r.equipment_code}</td><td>{formatNumber(r.runtime_hours)}</td><td>{formatNumber(r.failure_downtime_hours)}</td><td>{r.failure_count}</td><td>{formatNumber(r.mttr_hours)}</td><td>{formatNumber(r.mtbf_hours)}</td><td>{formatNumber(r.availability_pct)}</td><td>{r.missing_hour_months>0?"Thiếu "+r.missing_hour_months+" tháng giờ. ":""}{r.open_failures+r.carry_in_failures>0?"Có sự cố qua kỳ/chưa kết thúc; MTTR tạm tính. ":""}{r.unclassified_downtime_hours>0?"Còn giờ dừng chưa phân loại. ":""}{r.missing_hour_months===0 && r.open_failures+r.carry_in_failures===0 && r.unclassified_downtime_hours===0?"Đủ dữ liệu cửa sổ":""}</td></tr>)}
  </tbody></table></div><p>“—” là không đủ dữ liệu hoặc không có mẫu, không phải 0. Availability này chỉ xét dừng vì sự cố, không phải sẵn sàng lịch 24/7.</p></section>
  <section className="panel"><h2>Chi phí vật tư theo phương tiện / kỳ</h2><div className="overflow-x-auto"><table><thead><tr><th>PTTB</th><th>Chi phí đã định giá (VND)</th><th>Dòng thiếu giá</th><th>Số container (chiếc)</th></tr></thead><tbody>{cc.map(r=><tr key={r.equipment_id}><td>{r.equipment_code}</td><td>{formatNumber(r.known_cost_vnd,0)}</td><td>{r.unpriced_usages}</td><td>{formatNumber(r.container_boxes,0)}</td></tr>)}</tbody></table></div><p>Giá tại lần sử dụng, kỳ theo ngày lắp thực tế. Chỉ báo cáo tổng chi phí và số container; không tính tỷ suất quy đổi. Số container có thể chưa đầy đủ nếu thiếu tháng.</p></section>
  <section className="panel"><h2>Nhóm nguyên nhân sự cố</h2>{ca.map(r=><div className="grid items-center gap-2 sm:grid-cols-3" key={r.cause}><span>{causeLabels[r.cause]}</span><meter aria-label={causeLabels[r.cause]} min={0} max={100} value={r.percentage??0}/><span>{r.incident_count} sự cố · {formatNumber(r.percentage)}%</span></div>)}</section>
  <div className="grid gap-4 lg:grid-cols-2"><section className="panel"><h2>Tồn đọng kỹ thuật · {tech.data?.length??0} hạng mục</h2>{tech.data?.map(r=><article className="border-b py-3" key={r.item_id}><strong>{r.equipment_code} · {r.order_code}</strong><p>{r.symptom}</p><p>{progressLabels[r.execution_status]??r.execution_status} · {progressLabels[r.material_status]??r.material_status}</p></article>)}</section>
  <section className="panel"><h2>Tồn đọng thủ tục · {paper.data?.length??0} hạng mục</h2><p>Máy đang khai thác, hạng mục đã hoàn thành nhưng còn vay/phiếu/chứng từ. Không cộng lượng vay giữa các đơn vị khác nhau.</p>{paper.data?.map(r=><article className="border-b py-3" key={r.item_id}><strong>{r.equipment_code} · {r.order_code}</strong><p>{r.symptom}</p><p>{progressLabels[r.material_status]??r.material_status} · {progressLabels[r.dossier_status]??r.dossier_status} · {r.unsettled_material_lines} dòng vật tư chưa tất toán</p></article>)}</section></div>
 </>;
}
