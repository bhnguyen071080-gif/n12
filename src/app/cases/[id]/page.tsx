import Link from "next/link";
import {notFound} from "next/navigation";
import {session} from "@/lib/supabase";
import {uuid} from "@/lib/domain";
import {itemSchema,kindLabels} from "@/lib/followup";
import {dayLabel} from "@/lib/monthly-hours";
import {ItemEditor,MaterialsEditor,ReturnEditor} from "@/components/case-editor";
export const dynamic="force-dynamic";
export default async function CasePage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!uuid.safeParse(id).success)notFound();const {client}=await session("/cases/"+id);
 const result=await client.from("work_cases").select("*").eq("id",id).eq("tracking_only",true).maybeSingle();
 if(result.error)throw new Error("Không đọc được vụ việc.");if(!result.data)notFound();const c=result.data;
 const [equipment,order,followup]=await Promise.all([
 client.from("equipment").select("id,workspace_id,code,name").eq("id",c.equipment_id).single(),
 client.from("repair_orders").select("*").eq("case_id",id).single(),client.from("case_material_followups").select("*").eq("case_id",id).single()]);
 if(equipment.error||order.error||followup.error)throw new Error("Không đọc được liên kết vụ việc.");
 const [itemsResult,materials]=await Promise.all([
 client.from("repair_work_items").select("*").eq("repair_order_id",order.data.id).order("item_no"),
 client.from("materials").select("*").eq("workspace_id",equipment.data.workspace_id).order("code")]);
 if(itemsResult.error||materials.error)throw new Error("Không đọc được hạng mục/vật tư.");const items=itemSchema.array().parse(itemsResult.data);
 const usages=items.length?await client.from("repair_material_usages").select("*").in("repair_work_item_id",items.map(i=>i.id)):null;
 if(usages?.error)throw new Error("Không đọc được vật tư.");
 return <><h1>{c.code}</h1><p>{equipment.data.code} · {kindLabels[c.kind]} · Hồ sơ {order.data.code}</p>
 <p>Nhập lúc {new Date(c.created_at).toLocaleString("vi-VN",{timeZone:"Asia/Bangkok"})} · {c.summary}</p>
 <div className="flex flex-wrap gap-4"><Link href={"/cases?workspace="+equipment.data.workspace_id}>Danh sách vụ việc</Link><Link href={"/equipment/"+equipment.data.code+"?workspace="+equipment.data.workspace_id}>Lý lịch phương tiện</Link></div>
 <ReturnEditor key={followup.data.version_no} followup={followup.data}/>
 {items.map(i=><section className="panel space-y-5" key={i.id+":"+i.version_no}><h2>Hạng mục {i.item_no} · thực hiện {dayLabel(i.performed_on)}</h2>
 <ItemEditor order={order.data.id} item={i}/><MaterialsEditor item={i.id} materials={materials.data??[]} usages={usages?.data?.filter(u=>u.repair_work_item_id===i.id)??[]}/></section>)}
 <section className="panel"><details><summary className="mb-3 cursor-pointer font-bold">Thêm hạng mục</summary><ItemEditor order={order.data.id}/></details></section></>;
}
