import Link from "next/link";
import {z} from "zod";
import {session} from "@/lib/supabase";
import {equipmentCode,equipmentSchema,formatNumber,statusLabels,uuid} from "@/lib/domain";
import {ConfirmFault,QuickEntry} from "@/components/quick-entry";
export const dynamic="force-dynamic";
const item=z.object({symptom:z.string(),root_cause:z.string(),solution_plan:z.string(),execution_result:z.string(),
 materials:z.array(z.object({code:z.string(),name:z.string(),quantity:z.number(),unit:z.string()})).optional()});
export default async function EquipmentPage({params,searchParams}:{params:Promise<{code:string}>;searchParams:Promise<{workspace?:string;action?:string}>}){
 const {code}=await params,p=await searchParams;
 if(!equipmentCode.safeParse(code).success || (p.workspace && !uuid.safeParse(p.workspace).success))return <p>Mã phương tiện/không gian dữ liệu không hợp lệ.</p>;
 const next="/equipment/"+code+"?"+new URLSearchParams({...p}).toString(),{client}=await session(next);
 let query=client.from("equipment").select("*").eq("code",code);if(p.workspace)query=query.eq("workspace_id",p.workspace);
 const result=await query.limit(2);if(result.error)throw new Error("Không đọc được thiết bị");
 const rows=equipmentSchema.array().parse(result.data);
 if(!rows.length)return <p>Không tìm thấy thiết bị hoặc chưa có quyền truy cập.</p>;
 if(rows.length>1)return <><h1>Chọn không gian dữ liệu của {code}</h1>{rows.map(e=><p key={e.id}><Link href={"/equipment/"+code+"?workspace="+e.workspace_id+"&action="+(p.action??"quick-inspect")}>{e.workspace_id}</Link></p>)}</>;
 const e=rows[0],[history,faults]=await Promise.all([
  client.from("vw_equipment_history").select("*").eq("equipment_id",e.id).order("event_at",{ascending:false}).limit(100),
  client.from("failure_incidents").select("*").eq("equipment_id",e.id).eq("confirmed",false)]);
 if(history.error || faults.error)throw new Error("Không đọc được lý lịch");
 const qr="/api/equipment/"+code+"/qr?workspace="+e.workspace_id;
 return <><h1>{e.code} · {e.name}</h1><p>{statusLabels[e.status]} · Giờ hoạt động lũy kế: {formatNumber(e.accumulated_hours)} h</p>
  <div className="grid gap-5 lg:grid-cols-2"><QuickEntry equipment={e.id} mode={p.action==="quick-fault"?"fault":"inspection"}/>
  <section className="panel"><h2>QR định danh phương tiện</h2><p>QR chứa đường dẫn, không chứa quyền truy cập. APP_BASE_URL cần là địa chỉ triển khai ổn định.</p><img src={qr} alt={"QR mở kiểm tra nhanh "+e.code} width={256} height={256}/><Link className="button" href={qr}>Mở / tải nhãn QR</Link><p>In mã phương tiện cạnh QR để nhận diện khi nhãn bị hỏng.</p></section></div>
  {faults.data && faults.data.length>0 && <section className="panel"><h2>Sự cố đang chờ kỹ thuật xác nhận</h2>{faults.data.map(i=><article key={i.id} className="mb-4"><p>{new Date(i.occurred_at).toLocaleString("vi-VN",{timeZone:"Asia/Bangkok"})}</p><ConfirmFault id={i.id}/></article>)}</section>}
  <section className="panel"><h2>Lý lịch tự tổng hợp (100 sự kiện gần nhất)</h2>{history.data?.map(h=><article key={h.event_key} className="border-b py-4"><strong>{h.case_code??h.order_code} · {new Date(h.event_at).toLocaleString("vi-VN",{timeZone:"Asia/Bangkok"})}</strong><p>{h.title}</p>
   {item.array().safeParse(h.work_items).success && item.array().parse(h.work_items).map((i,n)=><details key={n}><summary>Hạng mục {n+1}: {i.symptom}</summary><p>Nguyên nhân: {i.root_cause||"Chưa ghi"}</p><p>Phương án: {i.solution_plan||"Chưa ghi"}</p><p>Kết quả: {i.execution_result||"Chưa ghi"}</p>{i.materials?.map((m,j)=><p key={j}>{m.code} · {m.name}: {formatNumber(m.quantity,3)} {m.unit}</p>)}</details>)}
  </article>)}</section>
 </>;
}
