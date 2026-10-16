import "server-only";
import {createHash} from "node:crypto";
import {JWT} from "google-auth-library";
import {z} from "zod";
import {equipmentCode} from "./domain";
import {thContainerRows,thHoursRows,hoursIssues} from "./sheets-layout";
export const sourceSchema=z.object({
 id:z.string().uuid(),workspace_id:z.string().uuid(),spreadsheet_id:z.string().regex(/^[A-Za-z0-9_-]{20,150}$/),
 tab_name:z.string().min(1).max(100),a1_range:z.string(),equipment_aliases:z.record(equipmentCode),source_kind:z.enum(["container","hours"]),start_month:z.string().nullable()
});
export function boundedRange(range:string){
 const m=/^([A-Z]{1,2})([1-9]\d{0,3}):([A-Z]{1,2})([1-9]\d{0,3})$/.exec(range);
 if(!m)throw new Error("Cần vùng A1 có giới hạn");
 const col=(s:string)=>Array.from(s).reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);
 const n=(col(m[3])-col(m[1])+1)*(Number(m[4])-Number(m[2])+1);
 if(col(m[3])<col(m[1]) || Number(m[4])<Number(m[2]) || n<1 || n>50000)throw new Error("Vùng đọc tối đa 50.000 ô");
 return range;
}
export async function previewSource(source:unknown){
 const s=sourceSchema.parse(source),email=process.env.GOOGLE_SHEETS_CLIENT_EMAIL,key=process.env.GOOGLE_SHEETS_PRIVATE_KEY;
 if(!email || !key)throw new Error("Chưa cấu hình kết nối Sheets chỉ đọc");
 const configured:unknown=JSON.parse(process.env.GOOGLE_SHEETS_ALLOWED_SOURCES??"{}");
 const allowlist=z.record(z.array(z.string())).parse(configured);
 if(!allowlist[s.workspace_id]?.includes(s.spreadsheet_id))throw new Error("Nguồn chưa được quản trị triển khai cho phép trong workspace này");
 const auth=new JWT({email,key:key.replace(/\\n/g,"\n"),scopes:["https://www.googleapis.com/auth/spreadsheets.readonly"]});
 const range="'"+s.tab_name.replaceAll("'","''")+"'!"+boundedRange(s.a1_range);
 const url=new URL("https://sheets.googleapis.com/v4/spreadsheets/"+s.spreadsheet_id+"/values/"+encodeURIComponent(range));
 url.searchParams.set("valueRenderOption","UNFORMATTED_VALUE");url.searchParams.set("majorDimension","ROWS");
 const headers=await auth.getRequestHeaders(url.toString());
 const response=await fetch(url,{headers:headers as HeadersInit,cache:"no-store",signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error("Không đọc được file nguồn bằng quyền Viewer");
 const body:unknown=await response.json();
 const data=z.object({values:z.array(z.array(z.unknown())).optional()}).parse(body);
 if(s.source_kind==="hours" && !s.start_month)throw new Error("Nguồn giờ cần tháng bắt đầu quản lý");
 const matrix=data.values??[],kind=s.source_kind;
 const hourRows=kind==="hours"?thHoursRows(matrix,s.equipment_aliases,s.start_month!):undefined;
 const rows=hourRows??thContainerRows(matrix,s.equipment_aliases);
 const issues=hourRows?hoursIssues(hourRows):[];
 const hash=createHash("sha256").update(JSON.stringify({kind,startMonth:s.start_month,rows})).digest("hex");
 return {rows,issues,kind,startMonth:s.start_month,hash,sourceId:s.id,workspace:s.workspace_id};
}
