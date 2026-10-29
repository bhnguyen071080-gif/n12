import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {PDFDocument,rgb} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {strToU8,zipSync} from "fflate";
import {configured,serverClient} from "@/lib/supabase";
import {monthStart,uuid} from "@/lib/domain";
import {inclusiveRange} from "@/lib/monthly-hours";
import {csvOutput} from "@/lib/csv";

export const dynamic="force-dynamic";
type Row={category:string;equipment:string;hours:number;months:number;boxes:number};
const xml=(value:unknown)=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[ch]!));
const col=(n:number)=>{let s="";for(;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};

async function data(request:Request){
 if(!configured())throw new Error("config");const p=new URL(request.url).searchParams,workspace=uuid.parse(p.get("workspace")),bounds=inclusiveRange(p.get("from")??"",p.get("to")??""),group=(p.get("group")??"").trim();
 const client=await serverClient(),user=await client.auth.getUser();if(!user.data.user)throw new Error("auth");
 const equipment=await client.from("equipment").select("id,code,category").eq("workspace_id",workspace);
 if(equipment.error)throw new Error("permission");
 const activityRows:{equipment_id:string;operating_hours:number|null;boxes:number|null}[]=[];
 for(let offset=0;;offset+=1000){
  const activity=await client.rpc("read_monthly_activity",{p_workspace:workspace,p_from:bounds.from,p_to:bounds.to,p_group:group||null,p_offset:offset,p_limit:1000});
  if(activity.error)throw new Error("permission");const page=activity.data??[];activityRows.push(...page);if(page.length<1000)break;
 }
 const byId=new Map(equipment.data.map(row=>[row.id,row])),summary=new Map<string,Row>();
 for(const item of activityRows){const eq=byId.get(item.equipment_id);if(!eq)continue;const row=summary.get(eq.id)??{category:eq.category,equipment:eq.code,hours:0,months:0,boxes:0};row.hours+=Number(item.operating_hours??0);row.boxes+=Number(item.boxes??0);if(item.operating_hours!==null)row.months+=1;summary.set(eq.id,row);}
 return {rows:[...summary.values()].sort((a,b)=>a.equipment.localeCompare(b.equipment,"vi")),from:bounds.from.slice(0,7),to:bounds.to.slice(0,7),group:group||"Tất cả"};
}

function workbook(rows:Row[],title:string){
 const matrix:[[string,...string[]],...(string|number)[][]]=[[title,"","","",""] ,["Nhóm","Phương tiện","Giờ chạy","Số tháng có dữ liệu","Container (chiếc)"],...rows.map(row=>[row.category,row.equipment,row.hours,row.months,row.boxes])];
 const sheet=matrix.map((row,r)=>`<row r="${r+1}">${row.map((value,c)=>typeof value==="number"?`<c r="${col(c+1)}${r+1}"><v>${value}</v></c>`:`<c r="${col(c+1)}${r+1}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`).join("")}</row>`).join("");
 const files:Record<string,Uint8Array>={
  "[Content_Types].xml":strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'),
  "_rels/.rels":strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
  "xl/workbook.xml":strToU8('<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Tong hop" sheetId="1" r:id="rId1"/></sheets></workbook>'),
  "xl/_rels/workbook.xml.rels":strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'),
  "xl/styles.xml":strToU8('<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Arial"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellXfs></styleSheet>'),
  "xl/worksheets/sheet1.xml":strToU8(`<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="18" customWidth="1"/><col min="2" max="2" width="18" customWidth="1"/><col min="3" max="5" width="20" customWidth="1"/></cols><sheetData>${sheet}</sheetData></worksheet>`),
 };
 return zipSync(files,{level:6});
}

async function pdf(rows:Row[],title:string){
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);const [regularBytes,boldBytes]=await Promise.all([readFile(join(process.cwd(),"assets/fonts/NotoSerif-Regular.ttf")),readFile(join(process.cwd(),"assets/fonts/NotoSerif-Bold.ttf"))]),regular=await doc.embedFont(regularBytes,{subset:true}),bold=await doc.embedFont(boldBytes,{subset:true});
 const width=842,height=595,margin=36,columns=[120,150,130,150,150],headers=["Nhóm","Phương tiện","Giờ chạy","Số tháng có dữ liệu","Container (chiếc)"];let page=doc.addPage([width,height]),y=height-margin;
 const line=(values:string[],head=false)=>{if(y<margin+24){page=doc.addPage([width,height]);y=height-margin;line(headers,true);}let x=margin;values.forEach((value,i)=>{page.drawRectangle({x,y:y-22,width:columns[i],height:22,borderWidth:.5,borderColor:rgb(.4,.4,.4)});page.drawText(value.slice(0,28),{x:x+4,y:y-15,size:head?9:8,font:head?bold:regular});x+=columns[i];});y-=22;};
 page.drawText(title,{x:margin,y:y-14,size:14,font:bold});y-=28;line(headers,true);rows.forEach(row=>line([row.category,row.equipment,row.hours.toLocaleString("vi-VN"),String(row.months),row.boxes.toLocaleString("vi-VN")]));return doc.save();
}

export async function GET(request:Request){
 try{const report=await data(request),p=new URL(request.url).searchParams,format=p.get("format")??"csv",title=`Tổng hợp phương tiện ${report.group} · ${report.from} đến ${report.to}`;
  if(format==="xlsx")return new Response(Uint8Array.from(workbook(report.rows,title)).buffer,{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":'attachment; filename="tv-eam-monthly.xlsx"',"Cache-Control":"private, no-store"}});
  if(format==="pdf")return new Response(Uint8Array.from(await pdf(report.rows,title)).buffer,{headers:{"Content-Type":"application/pdf","Content-Disposition":'attachment; filename="tv-eam-monthly.pdf"',"Cache-Control":"private, no-store"}});
  const csv=csvOutput(["Nhom","Phuong_tien","Gio_chay","So_thang_co_du_lieu","Container_chiec"],report.rows.map(row=>[row.category,row.equipment,row.hours,row.months,row.boxes]));return new Response(csv,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":'attachment; filename="tv-eam-monthly-google-sheets.csv"',"Cache-Control":"private, no-store"}});
 }catch(error){const message=error instanceof Error?error.message:"error";return new Response(message==="auth"?"Cần đăng nhập":message==="permission"?"Không có quyền":"Tham số không hợp lệ",{status:message==="auth"?401:message==="permission"?403:400});}
}
