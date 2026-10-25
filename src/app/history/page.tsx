import Link from "next/link";
import {z} from "zod";
import {context} from "@/lib/supabase";
import {localInputNow} from "@/lib/domain";
import {WorkspaceSelect} from "@/components/workspace-select";
import {DocumentPrintButton} from "@/components/document-print-button";
import {equipmentHistoryHeading,equipmentHistoryTitle,groupEquipmentHistory,type EquipmentHistoryRow} from "@/lib/equipment-history";
import {equipmentLabel} from "@/lib/equipment-display";

export const dynamic="force-dynamic";

const itemSchema=z.object({
 performed_on:z.string().nullable().optional(),symptom:z.string().default(""),root_cause:z.string().default(""),
 solution_plan:z.string().default(""),execution_result:z.string().default(""),
}).strip();

type HistoryParams={workspace?:string;equipment?:string;from?:string;to?:string};

function validDay(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+"T00:00:00+07:00"));}
function displayDay(value:string){return new Date(value+"T00:00:00+07:00").toLocaleDateString("vi-VN",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"Asia/Bangkok"});}

export default async function EquipmentHistory({searchParams}:{searchParams:Promise<HistoryParams>}){
 const p=await searchParams,c=await context(p.workspace);if(!c.workspace)return <p>Chưa có workspace.</p>;
 const w=c.workspace.id,today=localInputNow().slice(0,10),from=p.from??today.slice(0,4)+"-01-01",to=p.to??today;
 if(!validDay(from)||!validDay(to)||from>to)return <p>Khoảng ngày không hợp lệ.</p>;
 const equipment=await c.client.from("equipment").select("id,code,name").eq("workspace_id",w).order("code");
 if(equipment.error)throw new Error("Không đọc được danh mục phương tiện.");
 const selected=p.equipment?equipment.data.find(row=>row.id===p.equipment):undefined;
 if(p.equipment&&!selected)return <p>Phương tiện không hợp lệ hoặc chưa có quyền xem.</p>;
 const ids=selected?[selected.id]:equipment.data.map(row=>row.id);
 let events:{equipment_id:string;event_key:string;event_at:string;case_code:string|null;order_code:string|null;title:string;work_items:unknown}[]=[];
 if(ids.length){
  const pageSize=1000;
  for(let offset=0;;offset+=pageSize){
   const result=await c.client.from("vw_equipment_history").select("equipment_id,event_key,event_at,case_code,order_code,title,work_items").in("equipment_id",ids).gte("event_at",from+"T00:00:00+07:00").lte("event_at",to+"T23:59:59.999+07:00").order("event_at",{ascending:true}).order("event_key",{ascending:true}).range(offset,offset+pageSize-1);
   if(result.error)throw new Error("Không đọc được dữ liệu lý lịch.");
   const page=result.data??[];events.push(...page);if(page.length<pageSize)break;
  }
 }
 const equipmentById=new Map(equipment.data.map(row=>[row.id,row]));
 const rows:EquipmentHistoryRow[]=events.flatMap(event=>{
  const parsed=itemSchema.array().safeParse(event.work_items),items=parsed.success&&parsed.data.length?parsed.data:[{performed_on:null,symptom:event.title,root_cause:"",solution_plan:"",execution_result:""}];
  return items.map((item,index)=>({key:event.event_key+":"+index,equipment:equipmentById.get(event.equipment_id),day:item.performed_on??event.event_at.slice(0,10),
   content:[item.symptom,item.root_cause&&"Nguyên nhân: "+item.root_cause,item.solution_plan&&"Phương án: "+item.solution_plan,item.execution_result&&"Kết quả: "+item.execution_result].filter(Boolean).join(". ")}));
 });
 const groups=groupEquipmentHistory(rows,selected?[selected]:equipment.data);
 return <><div className="history-screen-heading no-print"><div><p className="eyebrow">LÝ LỊCH PHƯƠNG TIỆN</p><h1>{equipmentHistoryHeading}</h1></div><WorkspaceSelect workspaces={c.workspaces} selected={w}/></div>
  <section className="panel no-print"><h2>Chọn phạm vi lý lịch</h2><form method="get" className="history-filters"><input type="hidden" name="workspace" value={w}/>
   <label>Tên phương tiện<select name="equipment" defaultValue={selected?.id??""}><option value="">Tất cả phương tiện</option>{equipment.data.map(row=><option key={row.id} value={row.id}>{equipmentLabel(row)}</option>)}</select></label>
   <label>Từ ngày<input type="date" name="from" defaultValue={from} required/></label><label>Đến ngày<input type="date" name="to" defaultValue={to} required/></label>
   <button type="submit">Xác nhận lựa chọn</button>
  </form><DocumentPrintButton/><p className="muted">Không chọn phương tiện nghĩa là lấy tất cả. Dữ liệu lấy trực tiếp từ ngày thực hiện và nội dung đã ghi trong vụ việc.</p></section>
  {groups.map(group=><section className="panel history-sheet" key={group.equipment.id}><header><h2>{equipmentHistoryTitle(group.equipment)}</h2></header>
   <div className="overflow-x-auto"><table className="history-table"><thead><tr><th>Ngày, tháng, năm</th><th>Nội dung sửa chữa thay thế cải tạo</th><th>Chữ ký của người chịu trách nhiệm về hoạt động và an toàn máy trục</th></tr></thead><tbody>
    {group.rows.map(row=><tr key={row.key}><td>{displayDay(row.day)}</td><td><p>{row.content||"Chưa ghi nội dung chi tiết"}</p></td><td><span className="signature-space" aria-label="Ô chữ ký"/></td></tr>)}
   </tbody></table></div>
  </section>)}{!groups.length&&<section className="panel history-empty"><p>Không có nội dung lý lịch trong phạm vi đã chọn.</p></section>}<p className="no-print"><Link href={"/cases?workspace="+w}>Quay lại Vụ việc & lý lịch</Link></p></>;
}

