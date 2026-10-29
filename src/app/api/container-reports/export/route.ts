import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {PDFDocument,rgb} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {strToU8,zipSync} from "fflate";
import {configured,serverClient} from "@/lib/supabase";
import {uuid} from "@/lib/domain";
import {annualByGroup,containerStatusLabels,monthText,type ContainerGroup,type ContainerReportRow,type ContainerReportStatus} from "@/lib/container-reports";

export const dynamic="force-dynamic";
const xml=(value:unknown)=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[ch]!));
const col=(n:number)=>{let s="";for(;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
type Report={rows:ContainerReportRow[];year:number;filter:string;exportedAt:string;exporter:string};

async function reportData(request:Request):Promise<Report>{
 if(!configured())throw new Error("config");const p=new URL(request.url).searchParams,workspace=uuid.parse(p.get("workspace")),year=Number(p.get("year"));if(!Number.isInteger(year)||year<2000||year>2100)throw new Error("params");
 const groupRaw=p.get("group")??"",group=(['TK','QC','RTG'].includes(groupRaw)?groupRaw:"") as ContainerGroup|"",equipment=p.get("equipment")??"",month=/^(0[1-9]|1[0-2])$/.test(p.get("month")??"")?p.get("month")!:"",statusRaw=p.get("status")??"",status=(['draft','summarized','checked','locked'].includes(statusRaw)?statusRaw:"") as ContainerReportStatus|"",client=await serverClient(),user=await client.auth.getUser();if(!user.data.user)throw new Error("auth");
 let query=client.from("vw_container_report_monthly").select("*").eq("workspace_id",workspace).gte("month",`${year}-01-01`).lte("month",`${year}-12-31`).is("cancelled_at",null).order("month").order("equipment_code");
 if(group)query=query.eq("equipment_group",group);if(equipment)query=query.eq("equipment_id",uuid.parse(equipment));if(month)query=query.eq("month",`${year}-${month}-01`);if(status)query=query.eq("status",status);
 const result=await query.limit(5000);if(result.error)throw new Error("permission");
 const filters=[`Năm ${year}`,group&&`Nhóm ${group}`,equipment&&`Phương tiện đã chọn`,month&&`Tháng ${Number(month)}`,status&&`Trạng thái ${containerStatusLabels[status as keyof typeof containerStatusLabels]??status}`].filter(Boolean).join(" · ");
 return {rows:result.data as ContainerReportRow[],year,filter:filters,exportedAt:new Date().toLocaleString("vi-VN",{timeZone:"Asia/Bangkok"}),exporter:user.data.user.email??user.data.user.id};
}

function workbook(r:Report){
 const groups=annualByGroup(r.rows),matrix:(string|number)[][]=[
  ["BÁO CÁO SỐ LƯỢNG CONTAINER TK / QC / RTG"],["Bộ lọc",r.filter],["Ngày xuất",r.exportedAt],["Người xuất",r.exporter],[],
  ["Kỳ","Nhóm","Mã phương tiện","Tên phương tiện","Số container","Người tổng hợp","Trạng thái","Ghi chú"],
  ...r.rows.map(row=>[monthText(row.month),row.equipment_group,row.equipment_code,row.equipment_name,row.boxes,row.compiler_name,containerStatusLabels[row.status],row.notes]),[],
  ["TỔNG HỢP NĂM THEO NHÓM",...Array(14).fill("")],["Nhóm",...Array.from({length:12},(_,i)=>`Tháng ${i+1}`),"Tổng năm"],
  ...groups.map(row=>[row.group,...row.months,row.total])
 ];
 const sheet=matrix.map((row,index)=>`<row r="${index+1}">${row.map((value,c)=>typeof value==="number"?`<c r="${col(c+1)}${index+1}"><v>${value}</v></c>`:`<c r="${col(c+1)}${index+1}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`).join("")}</row>`).join("");
 const files:Record<string,Uint8Array>={
  "[Content_Types].xml":strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'),
  "_rels/.rels":strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
  "xl/workbook.xml":strToU8('<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Bao cao container" sheetId="1" r:id="rId1"/></sheets></workbook>'),
  "xl/_rels/workbook.xml.rels":strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'),
  "xl/styles.xml":strToU8('<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Arial"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellXfs></styleSheet>'),
  "xl/worksheets/sheet1.xml":strToU8(`<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="16" width="18" customWidth="1"/></cols><sheetData>${sheet}</sheetData></worksheet>`)
 };return zipSync(files,{level:6});
}

async function pdf(r:Report){
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);const [regularBytes,boldBytes]=await Promise.all([readFile(join(process.cwd(),"assets/fonts/NotoSerif-Regular.ttf")),readFile(join(process.cwd(),"assets/fonts/NotoSerif-Bold.ttf"))]),regular=await doc.embedFont(regularBytes,{subset:true}),bold=await doc.embedFont(boldBytes,{subset:true}),width=842,height=595,margin=32,columns=[66,48,72,170,78,150,85],headers=["Kỳ","Nhóm","Mã","Tên phương tiện","Container","Người tổng hợp","Trạng thái"];let page=doc.addPage([width,height]),y=height-margin;
 const heading=()=>{page.drawText("BÁO CÁO SỐ LƯỢNG CONTAINER TK / QC / RTG",{x:margin,y:y-14,size:14,font:bold});y-=25;page.drawText(r.filter,{x:margin,y:y-10,size:8,font:regular});y-=14;page.drawText(`Ngày xuất: ${r.exportedAt}  |  Người xuất: ${r.exporter}`,{x:margin,y:y-10,size:8,font:regular});y-=20;};
 const line=(values:string[],head=false)=>{if(y<margin+25){page=doc.addPage([width,height]);y=height-margin;heading();line(headers,true);}let x=margin;values.forEach((value,i)=>{page.drawRectangle({x,y:y-22,width:columns[i],height:22,borderWidth:.45,borderColor:rgb(.45,.5,.55)});page.drawText(value.slice(0,i===3?36:22),{x:x+3,y:y-14,size:head?7.5:7,font:head?bold:regular});x+=columns[i];});y-=22;};
 heading();line(headers,true);r.rows.forEach(row=>line([monthText(row.month),row.equipment_group,row.equipment_code,row.equipment_name,row.boxes.toLocaleString("vi-VN"),row.compiler_name,containerStatusLabels[row.status]]));
 y-=12;line(["Năm","Nhóm","","","Container","",""],true);annualByGroup(r.rows).forEach(group=>line([String(r.year),group.group,"","",group.total.toLocaleString("vi-VN"),"",""]));return doc.save();
}

export async function GET(request:Request){try{const r=await reportData(request),format=new URL(request.url).searchParams.get("format")??"xlsx";if(format==="pdf")return new Response(Uint8Array.from(await pdf(r)).buffer,{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="container-${r.year}.pdf"`,"Cache-Control":"private, no-store"}});return new Response(Uint8Array.from(workbook(r)).buffer,{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":`attachment; filename="container-${r.year}.xlsx"`,"Cache-Control":"private, no-store"}});}catch(error){const message=error instanceof Error?error.message:"error";return new Response(message==="auth"?"Cần đăng nhập":message==="permission"?"Không có quyền":"Tham số không hợp lệ",{status:message==="auth"?401:message==="permission"?403:400});}}
