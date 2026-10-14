import {z} from "zod";
export const equipmentCategories=["QC","RTG","TUKAN","SPREADER_SEMI_AUTO","SPREADER_AUTO","FORKLIFT","TRACTOR","TRAILER","AUXILIARY"] as const;
export const categoryLabels:Record<typeof equipmentCategories[number],string>={QC:"Cần trục giàn cầu cảng",RTG:"Cần trục giàn bãi",TUKAN:"Cần trục chân đế",SPREADER_SEMI_AUTO:"Khung cẩu bán tự động",SPREADER_AUTO:"Khung cẩu tự động",FORKLIFT:"Xe nâng",TRACTOR:"Đầu kéo",TRAILER:"Rơ moóc",AUXILIARY:"Thiết bị phụ trợ khác"};
export const baseStatusLabels={available:"Đang khai thác",stopped:"Dừng máy",decommissioned:"Ngừng sử dụng"};
const blankNull=(value:string)=>value.trim()===""?null:value.trim();
const hours=z.string().regex(/^\d+(\.\d{1,2})?$/,"Giờ ban đầu phải là số không âm, tối đa hai chữ số thập phân.").transform(Number).refine(n=>n<=1000000000,"Giờ ban đầu vượt giới hạn.");
const catalogInput=z.object({
 workspace:z.string().uuid(),id:z.string().uuid().nullable(),version:z.number().int().positive().nullable(),key:z.string().uuid(),
 code:z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{1,40}$/,"Mã gồm chữ không dấu, số, gạch ngang hoặc gạch dưới; tối đa 40 ký tự."),name:z.string().trim().min(1).max(200),
 category:z.enum(equipmentCategories),base_status:z.enum(["available","stopped","decommissioned"]),serial:z.string().trim().max(100).nullable(),
 year:z.number().int().min(1900).max(new Date().getFullYear()).nullable(),notes:z.string().trim().max(2000),
 aliases:z.array(z.string().regex(/^[A-Za-z0-9_-]{1,40}$/)).max(20).refine(a=>new Set(a.map(s=>s.toLowerCase())).size===a.length,"Các mã tham chiếu không được trùng nhau."),initial_hours:hours,confirmed:z.boolean(),
}).superRefine((v,c)=>{
 if(v.id===null && !v.confirmed)c.addIssue({code:z.ZodIssueCode.custom,path:["confirmed"],message:"Cần xác nhận đã đối chiếu giờ ban đầu; không dùng 0 thay cho chưa biết."});
 if((v.id===null)!==(v.version===null))c.addIssue({code:z.ZodIssueCode.custom,path:["version"],message:"Phiên bản danh mục không hợp lệ; hãy tải lại trang."});
});
export function parseCatalogForm(data:FormData){
 const get=(key:string)=>String(data.get(key)??"");
 return catalogInput.parse({workspace:get("workspace"),id:blankNull(get("equipment_id")),version:blankNull(get("version"))===null?null:Number(get("version")),key:get("request_key"),code:get("code"),name:get("name"),category:get("category"),base_status:get("base_status"),serial:blankNull(get("serial")),year:blankNull(get("year"))===null?null:Number(get("year")),notes:get("notes"),aliases:get("aliases").split(/[;,\n]/).map(s=>s.trim()).filter(Boolean),initial_hours:get("initial_hours"),confirmed:get("baseline_confirmed")==="on"});
}
