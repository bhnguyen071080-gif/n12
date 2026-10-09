import { z } from "zod";
export const uuid = z.string().uuid();
export const equipmentCode = z.string().regex(/^[A-Z0-9_-]{1,40}$/);
export const numeric = z.union([z.number().finite(),z.string().regex(/^-?\d+(\.\d+)?$/)]).transform(Number);
export const nullableNumeric = numeric.nullable();
export const equipmentSchema = z.object({
 id:uuid,workspace_id:uuid,code:equipmentCode,name:z.string(),category:z.string(),status:z.string(),
 accumulated_hours:numeric,initial_hours:numeric,team_id:uuid.nullable()
});
export const reliabilitySchema = z.object({
 equipment_id:uuid,equipment_code:equipmentCode,team_id:uuid.nullable(),runtime_hours:nullableNumeric,
 failure_downtime_hours:numeric,failure_count:numeric,mttr_hours:nullableNumeric,mtbf_hours:nullableNumeric,
 availability_pct:nullableNumeric,missing_hour_months:numeric,open_failures:numeric,carry_in_failures:numeric,unclassified_downtime_hours:numeric
});
export const costSchema = z.object({
 equipment_id:uuid,equipment_code:equipmentCode,known_cost_vnd:numeric,unpriced_usages:numeric,
 container_boxes:nullableNumeric,missing_container_months:numeric
});
export const causes = ["ELECTRICAL_PLC","HYDRAULICS_SPREADER","MECHANICAL_CABLE","ENGINE_DRIVE","UNCLASSIFIED"] as const;
export const causeLabels: Record<typeof causes[number],string> = {
 ELECTRICAL_PLC:"Hệ điện & PLC",HYDRAULICS_SPREADER:"Thủy lực & ngáng Spreader",
 MECHANICAL_CABLE:"Cơ khí & cáp",ENGINE_DRIVE:"Động cơ & truyền động",UNCLASSIFIED:"Chưa phân loại"
};
export const causeSchema=z.object({cause:z.enum(causes),incident_count:numeric,percentage:nullableNumeric});
export type Equipment=z.infer<typeof equipmentSchema>;
export type Reliability=z.infer<typeof reliabilitySchema>;
export type Cost=z.infer<typeof costSchema>;
export type Cause=z.infer<typeof causeSchema>;
export const statusLabels:Record<string,string>={available:"Đang khai thác",in_repair:"Đang sửa chữa",maintenance:"Bảo dưỡng",stopped:"Dừng máy",stopped_waiting_material:"Dừng chờ vật tư",decommissioned:"Ngừng sử dụng"};
export const progressLabels:Record<string,string>={
 waiting_shutdown:"Chờ dừng máy",in_progress:"Đang thi công",completed:"Hoàn thành",
 procurement_pending:"Chờ mua sắm",borrowed:"Đang vay vật tư",stock_available:"Đủ vật tư kho",
 not_required:"Không dùng vật tư",collecting:"Đang tập hợp",closed:"Đã đóng hồ sơ",
 missing_reimbursement_documents:"Thiếu chứng từ hoàn ứng",temporary_issue_debt:"Nợ phiếu tạm xuất",
 requisition_created:"Đã lập phiếu",not_applicable:"Không phát sinh",approval_pending:"Chờ duyệt"
};
export function formatNumber(value:number|null,digits=2):string {
 return value===null?"—":new Intl.NumberFormat("vi-VN",{maximumFractionDigits:digits}).format(value);
}
export function safeNext(value:string|undefined):string {
 if(!value || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return "/";
 try {
  const url=new URL(value,"https://internal.invalid");
  if(url.origin!=="https://internal.invalid" || !/^\/(equipment|reports|monthly|life|sheets)?(\/|\?|$)/.test(value)) return "/";
  return url.pathname+url.search;
 } catch {return "/";}
}
export function quickUrl(base:string,code:string,workspace:string,action:"quick-inspect"|"quick-fault"="quick-inspect"):string {
 equipmentCode.parse(code);uuid.parse(workspace);
 const origin=new URL(base);
 if(origin.username || origin.password || origin.pathname!=="/" || origin.search || origin.hash ||
 (origin.protocol!=="https:" && !(origin.protocol==="http:" && ["localhost","127.0.0.1"].includes(origin.hostname))))
  throw new Error("APP_BASE_URL phải là HTTPS origin, không kèm đường dẫn/token");
 const url=new URL("/equipment/"+encodeURIComponent(code),origin);
 url.searchParams.set("action",action);url.searchParams.set("workspace",workspace);return url.toString();
}
export function localInputNow(date=new Date()):string {
 const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date);
 const get=(type:Intl.DateTimeFormatPartTypes)=>p.find(x=>x.type===type)?.value??"";
 return get("year")+"-"+get("month")+"-"+get("day")+"T"+get("hour")+":"+get("minute");
}
export function actualTimestamp(value:string):string {
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Thiếu ngày giờ thực tế");
 const date=new Date(value+":00+07:00");
 if(!Number.isFinite(date.getTime()) || localInputNow(date)!==value) throw new Error("Ngày giờ thực tế không hợp lệ");
 return date.toISOString();
}
export function monthStart(value:string):string {
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || Number(value.slice(0,4))<2000) throw new Error("Tháng cần dạng YYYY-MM");
 return value+"-01";
}
export function period(from:string,to:string):{from:string;to:string} {
 const start=monthStart(from),end=monthStart(to);
 const span=(Number(to.slice(0,4))-Number(from.slice(0,4)))*12+Number(to.slice(5,7))-Number(from.slice(5,7));
 if(span<1 || span>36) throw new Error("Chọn kỳ 1–36 tháng; tháng kết thúc không tính vào kỳ");
 return {from:start,to:end};
}
export type MonthlyKind="hours"|"container"|"other";
const decimal=(scale:number)=>z.number().finite().nonnegative().refine(x=>Number.isSafeInteger(Math.round(x*10**scale)) && Math.abs(x*10**scale-Math.round(x*10**scale))<0.000001,"Sai số chữ số thập phân");
const base={equipment_code:equipmentCode,month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/)};
export const hoursRows=z.array(z.object({...base,operating_hours:decimal(2)}).strict()).min(1).max(1000);
export const containerRows=z.array(z.object({...base,boxes:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)}).strict()).min(1).max(1000);
export const otherRows=z.array(z.object({...base,cargo_code:z.string().min(1).max(40),quantity:decimal(3)}).strict()).min(1).max(1000);
