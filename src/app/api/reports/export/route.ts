import {serverClient,configured} from "@/lib/supabase";
import {period,uuid} from "@/lib/domain";
import {csvOutput} from "@/lib/csv";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 if(!configured())return new Response("Chưa cấu hình",{status:503});
 const p=new URL(request.url).searchParams;let span:{from:string;to:string},workspace:string;
 try{workspace=uuid.parse(p.get("workspace"));span=period(p.get("from")??"",p.get("to")??"");}catch{return new Response("Kỳ không hợp lệ",{status:400});}
 const client=await serverClient(),user=await client.auth.getUser();if(!user.data.user)return new Response("Cần đăng nhập",{status:401});
 const args={p_workspace:workspace,p_from:span.from,p_to:span.to};
 const [metrics,costs]=await Promise.all([client.rpc("report_reliability",args),client.rpc("report_material_costs",args)]);
 if(metrics.error || costs.error)return new Response("Không có quyền báo cáo",{status:403});
 const rows=(metrics.data??[]).map(r=>{const c=costs.data?.find(x=>x.equipment_id===r.equipment_id);return [
 r.equipment_code,span.from,span.to,r.runtime_hours,r.failure_downtime_hours,r.failure_count,r.mttr_hours,r.mtbf_hours,r.availability_pct,
 r.missing_hour_months,r.open_failures,r.carry_in_failures,r.unclassified_downtime_hours,c?.known_cost_vnd??null,c?.unpriced_usages??null,c?.container_boxes??null,c?.missing_container_months??null];});
 const csv=csvOutput(["PTTB","Tu_ngay","Den_ngay_loai_tru","Gio_thuc_chay","Gio_dung_su_co","So_su_co","MTTR_h","MTBF_h","Availability_pct","Thang_thieu_gio","Su_co_chua_ket_thuc","Su_co_qua_ky","Gio_dung_chua_phan_loai","Chi_phi_da_dinh_gia_VND","Dong_thieu_gia","Container_chiec","Thang_thieu_so_container"],rows);
 return new Response(csv,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":'attachment; filename="tv-eam-report.csv"',"Cache-Control":"private, no-store"}});
}
