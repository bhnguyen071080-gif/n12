import Link from "next/link";
import {notFound} from "next/navigation";
import {uuid} from "@/lib/domain";
import {session} from "@/lib/supabase";
import {planVoucherPayload,savedPlanVouchers} from "@/lib/saved-requisition-plan";
import {formatPlannedDay,supplySourceLabels} from "@/lib/maintenance-requisition-plan";
export const dynamic="force-dynamic";
export default async function SavedPlanPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!uuid.safeParse(id).success)notFound();
 const {client}=await session(`/requisitions/${id}`);
 const r=await client.from("maintenance_requisition_runs").select("*").eq("id",id).maybeSingle();
 if(r.error)throw new Error("Không đọc được kế hoạch");if(!r.data)notFound();
 const plan=r.data,vouchers=savedPlanVouchers(plan);
 return <div className="space-y-5">
  <section className="panel"><Link href={`/requisitions?workspace=${plan.workspace_id}`}>← Danh sách kế hoạch</Link><h1>Kế hoạch đã lưu · {formatPlannedDay(plan.planned_day)}</h1>
   <p>{plan.snapshot.rows.length} phương tiện · {vouchers.length} phiếu. Mỗi dòng vật tư giữ riêng theo phương tiện; hệ thống không cộng gộp số lượng.</p>
   <p className="muted">Đây là bản đã xác nhận. Số phiếu và ngày phiếu được lưu riêng theo từng phiếu; ngày kế hoạch 01/10/2026 vẫn giữ nguyên theo PDF nguồn.</p>
  </section>
  <section className="panel"><h2>Phiếu lĩnh BM.08.06</h2><p>Mỗi phiếu in hai liên A5 trên một tờ A4. Thực phát và đơn giá để trống để kho ghi nhận.</p>
   {vouchers.map((v,i)=>{const payload=planVoucherPayload(plan,v);return <article className="voucher-preview" key={v.id}><h3>{v.scopeLabel} · {supplySourceLabels[v.source]}</h3><p><strong>Số phiếu:</strong> {payload.document_number||"Chưa có (bản cũ)"} · <strong>Ngày phiếu:</strong> {formatPlannedDay(payload.document_at.slice(0,10))}</p><p>{v.equipmentCodes.join(", ")}</p>
    <table><thead><tr><th>STT</th><th>Vật tư</th><th>Danh điểm</th><th>ĐVT</th><th>Xin lĩnh</th><th>Ghi chú</th></tr></thead><tbody>{v.lines.map((l,lineIndex)=><tr key={`${l.equipmentCode??""}:${l.key}:${lineIndex}`}><td>{lineIndex+1}</td><td>{l.name}</td><td>{l.catalogueCode??l.name}</td><td>{l.unit}</td><td>{l.quantity.toLocaleString("vi-VN")}</td><td>{l.equipmentLabel??l.equipmentCode??""}</td></tr>)}</tbody></table>
    <a href={`/api/requisition-plans/${id}/pdf?voucher=${i}`} target="_blank" rel="noreferrer">Mở / in phiếu {i+1} (PDF)</a></article>;})}
  </section>
  <section className="panel"><h2>Vụ việc và phân bổ theo phương tiện</h2><div className="overflow-x-auto"><table><thead><tr><th>Phương tiện nguồn</th><th>Danh mục đã ghép</th><th>Vụ việc</th><th>Số lượng kế hoạch</th></tr></thead><tbody>
   {plan.snapshot.rows.map(row=><tr key={row.equipmentId}><td>{row.sourceLabel}</td><td>{row.equipmentCode} · {row.equipmentName}</td><td><Link href={`/cases/${row.caseId}`}>{row.caseCode}</Link></td><td>{row.materials.map(m=><div key={m.key}>{m.name}: {m.quantity} {m.unit}</div>)}</td></tr>)}
  </tbody></table></div></section>
 </div>;
}
