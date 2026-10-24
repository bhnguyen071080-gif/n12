import Link from "next/link";
import {saveMaintenanceRequisition} from "./actions";
import {RequisitionPlanForm} from "@/components/requisition-plan-form-v2";
import {WorkspaceSelect} from "@/components/workspace-select";
import {context} from "@/lib/supabase";
import {formatNumber,localInputNow} from "@/lib/domain";

export const dynamic="force-dynamic";
type Params={workspace?:string;type?:string;equipment?:string;from?:string;to?:string;material?:string};
type AppClient=Awaited<ReturnType<typeof context>>["client"];
const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").toLowerCase();

export default async function RequisitionsPage({searchParams}:{searchParams:Promise<Params>}){
 const params=await searchParams,current=await context(params.workspace);if(!current.workspace)return <p>Chưa có workspace.</p>;
 const w=current.workspace.id,equipment=await current.client.from("equipment").select("id,code,name,category").eq("workspace_id",w).order("code");
 if(equipment.error)throw new Error("Không đọc được danh mục phương tiện.");
 const kind=params.type==="repair"?"repair":"maintenance",workspaceQuery="workspace="+w;
 return <><WorkspaceSelect workspaces={current.workspaces} selected={w}/>
  <section className="panel requisition-type-picker"><p className="eyebrow">HAI LOẠI PHIẾU LĨNH</p><h1>Phiếu lĩnh vật tư</h1><div className="flex flex-wrap gap-4">
   <Link className={kind==="repair"?"button":"button button-secondary"} href={"/requisitions?"+workspaceQuery+"&type=repair"}>1. Sửa chữa, thay thế · theo vụ việc</Link>
   <Link className={kind==="maintenance"?"button":"button button-secondary"} href={"/requisitions?"+workspaceQuery+"&type=maintenance"}>2. Vật tư, vật liệu phục vụ bảo dưỡng</Link>
  </div></section>
  {kind==="repair"?<RepairRequisitions workspace={w} params={params} equipment={equipment.data}/>:<MaintenanceRequisitions workspace={w} workspaceName={current.workspace.name} equipment={equipment.data} client={current.client}/>}</>;
}

async function MaintenanceRequisitions({workspace,workspaceName,equipment,client}:{workspace:string;workspaceName:string;equipment:{id:string;code:string;name:string;category:string}[];client:AppClient}){
 const materials=await client.from("materials").select("id,code,name,unit").eq("workspace_id",workspace).order("code");
 if(materials.error)throw new Error("Không đọc được danh mục vật tư chuẩn.");
 const runs=await client.from("maintenance_requisition_runs").select("id,planned_day,document_day,voucher_kind,supplement_note,grouping_mode,created_at,source_filename").eq("workspace_id",workspace).order("created_at",{ascending:false}).limit(10);
 return <><RequisitionPlanForm key={workspace} saveAction={saveMaintenanceRequisition} workspace={workspace} workspaceName={workspaceName} equipment={equipment} materials={materials.data} today={localInputNow().slice(0,10)}/>
  {runs.error?<p role="alert">Không đọc được lịch sử phiếu đã lưu. Kiểm tra kết nối cơ sở dữ liệu.</p>:<section className="panel"><h2>Lịch sử phiếu lĩnh gần nhất</h2>{runs.data?.length?<div className="overflow-x-auto"><table><thead><tr><th>Loại phiếu</th><th>Ngày kế hoạch</th><th>Ngày phiếu lĩnh</th><th>Cách gom</th><th>Tệp PDF nguồn</th><th>Lý do bổ sung</th><th>Thời điểm xác nhận</th><th>Thao tác</th></tr></thead><tbody>{runs.data.map(run=><tr key={run.id}><td><Link href={`/requisitions/${run.id}`}>{run.voucher_kind==="supplemental"?"Bổ sung phát sinh":"Theo kế hoạch"}</Link></td><td>{run.planned_day}</td><td>{run.document_day??run.planned_day}</td><td>{run.grouping_mode}</td><td>{run.source_filename??"Bản cũ chưa lưu tên tệp"}</td><td>{run.supplement_note??"—"}</td><td>{new Date(run.created_at).toLocaleString("vi-VN",{timeZone:"Asia/Bangkok"})}</td><td><Link className="button button-secondary" href={`/requisitions/${run.id}`}>Xem trước / In</Link></td></tr>)}</tbody></table></div>:<p>Chưa có phiếu lĩnh được xác nhận.</p>}</section>}
 </>;
}

async function RepairRequisitions({workspace,params,equipment}:{workspace:string;params:Params;equipment:{id:string;code:string;name:string}[]}){
 const now=localInputNow().slice(0,10),from=params.from??now.slice(0,7)+"-01",to=params.to??now,selected=params.equipment&&equipment.some(row=>row.id===params.equipment)?params.equipment:"";
 const {client}=await context(workspace);let casesQuery=client.from("work_cases").select("id,equipment_id,code,summary,actual_started_at").eq("tracking_only",true).eq("kind","repair").gte("actual_started_at",from+"T00:00:00+07:00").lte("actual_started_at",to+"T23:59:59.999+07:00").order("actual_started_at",{ascending:false}).limit(500);
 if(selected)casesQuery=casesQuery.eq("equipment_id",selected);const cases=await casesQuery;if(cases.error)throw new Error("Không đọc được vụ việc sửa chữa.");
 const caseIds=cases.data.map(row=>row.id),orders=caseIds.length?await client.from("repair_orders").select("id,case_id").in("case_id",caseIds):{data:[],error:null};if(orders.error)throw new Error("Không đọc được hồ sơ sửa chữa.");
 const orderIds=orders.data.map(row=>row.id),items=orderIds.length?await client.from("repair_work_items").select("id,repair_order_id,performed_on").in("repair_order_id",orderIds):{data:[],error:null};if(items.error)throw new Error("Không đọc được hạng mục sửa chữa.");
 const itemIds=items.data.map(row=>row.id),usages=itemIds.length?await client.from("repair_material_usages").select("id,repair_work_item_id,material_id,quantity,supply_state,is_installed").in("repair_work_item_id",itemIds):{data:[],error:null};if(usages.error)throw new Error("Không đọc được dòng vật tư.");
 const materials=await client.from("materials").select("id,code,name,unit").eq("workspace_id",workspace);if(materials.error)throw new Error("Không đọc được danh mục vật tư.");
 const caseByOrder=new Map(orders.data.map(order=>[order.id,order.case_id])),caseById=new Map(cases.data.map(row=>[row.id,row])),itemById=new Map(items.data.map(item=>[item.id,item])),equipmentById=new Map(equipment.map(row=>[row.id,row])),materialById=new Map(materials.data.map(row=>[row.id,row]));
 const search=normalize(params.material?.trim()??"");
 const rows=usages.data.flatMap(usage=>{const item=itemById.get(usage.repair_work_item_id),caseId=item&&caseByOrder.get(item.repair_order_id),workCase=caseId&&caseById.get(caseId),material=materialById.get(usage.material_id);if(!item||!caseId||!workCase||!material)return[];if(search&&!normalize(material.code+" "+material.name).includes(search))return[];return[{...usage,item,workCase,material,equipment:equipmentById.get(workCase.equipment_id)}];});
 return <><section className="panel"><h2>Vật tư sửa chữa, thay thế theo vụ việc</h2><form method="get" className="requisition-filters"><input type="hidden" name="workspace" value={workspace}/><input type="hidden" name="type" value="repair"/>
   <label>Phương tiện<select name="equipment" defaultValue={selected}><option value="">Tất cả phương tiện</option>{equipment.map(row=><option key={row.id} value={row.id}>{row.code}</option>)}</select></label><label>Từ ngày<input type="date" name="from" defaultValue={from}/></label><label>Đến ngày<input type="date" name="to" defaultValue={to}/></label><label>Tên hoặc mã vật tư<input name="material" defaultValue={params.material??""}/></label><button type="submit">Xác nhận bộ lọc</button>
  </form></section>
  <section className="panel"><div className="section-heading"><h2>Kết quả theo dõi</h2><span className="count-chip">{rows.length} dòng</span></div><div className="overflow-x-auto"><table><thead><tr><th>Ngày</th><th>Vụ việc</th><th>Phương tiện</th><th>Vật tư chuẩn</th><th>Số lượng</th><th>Trạng thái</th><th>Phiếu</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{row.item.performed_on??row.workCase.actual_started_at.slice(0,10)}</td><td><Link href={"/cases/"+row.workCase.id}>{row.workCase.code}</Link><p>{row.workCase.summary}</p></td><td>{row.equipment?.code}</td><td>{row.material.code} · {row.material.name}</td><td>{formatNumber(row.quantity,3)} {row.material.unit}</td><td>{row.supply_state==="issued"?"Đã lĩnh":row.supply_state==="borrowed"?"Đang vay":"Dự trù"}{row.is_installed?" · Đã thay":""}</td><td><Link href={"/cases/"+row.workCase.id+"?document=material_requisition"}>Mở BM.08.06</Link></td></tr>)}</tbody></table></div>{!rows.length&&<p>Không có dòng vật tư phù hợp bộ lọc.</p>}</section></>;
}

