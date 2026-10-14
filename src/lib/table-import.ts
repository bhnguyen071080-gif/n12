import {z} from "zod";
import {parseCatalogForm,categoryLabels,baseStatusLabels} from "./equipment-catalog";
import {hoursRows,containerRows,otherRows,monthStart,equipmentCode} from "./domain";
export const importKinds=["equipment","materials","cargo","container","hours","other"] as const;
export type ImportKind=typeof importKinds[number];
export const cargoUnitLabels:Record<string,string>={TONNE:"tấn",M3:"m³",ITEM:"chiếc",TRIP:"chuyến"};
export const importSpecs:Record<ImportKind,{title:string;sheet:string;headers:string[];hint:string}>={
 equipment:{title:"Danh mục phương tiện",sheet:"Phương tiện",headers:["Mã phương tiện","Tên phương tiện","Loại thiết bị","Trạng thái nền","Số chế tạo","Năm sản xuất","Mã tham chiếu","Ghi chú"],hint:"Chưa rõ số chế tạo hoặc năm thì để trống. Không nhập giờ gốc tại đây. Cập nhật sẽ thay các trường danh mục của dòng đã chọn, không đổi giờ máy."},
 materials:{title:"Danh mục vật tư",sheet:"Vật tư",headers:["Mã vật tư","Tên vật tư","Đơn vị tính"],hint:"Chỉ khai báo mã, tên và đơn vị. Không tạo tồn kho hoặc đổi định mức. Đơn vị của mã đã có phải giữ nguyên."},
 cargo:{title:"Danh mục loại hàng",sheet:"Loại hàng",headers:["Mã loại hàng","Tên loại hàng","Đơn vị tính"],hint:"Khai báo loại hàng trước khi nhập sản lượng hàng khác. Không cộng các đơn vị khác nhau. Đơn vị của mã đã có phải giữ nguyên."},
 container:{title:"Số container hàng tháng",sheet:"Container tháng",headers:["Mã phương tiện","Tháng","Số container (chiếc)"],hint:"Mỗi phương tiện, mỗi tháng một dòng. Chỉ ghi số chiếc, không quy đổi hoặc cộng vào giờ máy."},
 hours:{title:"Giờ hoạt động hàng tháng",sheet:"Giờ hoạt động",headers:["Mã phương tiện","Tháng","Giờ hoạt động"],hint:"Nhập tổng giờ thực chạy trong tháng, không nhập giờ dừng hoặc đồng hồ lũy kế. Không nhập tháng đã nằm trong giờ gốc."},
 other:{title:"Sản lượng hàng khác hàng tháng",sheet:"Hàng khác tháng",headers:["Mã phương tiện","Tháng","Mã loại hàng","Sản lượng"],hint:"Mỗi phương tiện, tháng và loại hàng một dòng; đơn vị theo danh mục loại hàng. Container có mẫu riêng."},
};
export type ImportRow=Record<string,string|number|null|string[]>;
export type ImportIssue={line:number;column:string;message:string};
export type ImportPlan={row:ImportRow;expected:Record<string,unknown>|null;previous:ImportRow|null;action:"add"|"update"|"same"};
const code=(v:string)=>equipmentCode.parse(v.trim().toUpperCase());
const text=(v:string,max=200)=>z.string().trim().min(1).max(max).parse(v);
const number=(v:string,scale:number)=>{if(!new RegExp("^\\d+(?:[.,]\\d{1,"+scale+"})?$").test(v.trim()))throw Error("Cần số không âm, tối đa "+scale+" chữ số thập phân; không để trống hoặc dùng dấu hàng nghìn.");return Number(v.trim().replace(",","."));};
const month=(v:string)=>{if(!/^\d{4}-(0[1-9]|1[0-2])(-01)?$/.test(v))throw Error("Tháng cần dạng năm-tháng, ví dụ 2026-09, hoặc ngày đầu tháng.");return monthStart(v.slice(0,7));};
export function parseImportGrid(grid:(string|number|null)[][],kind:ImportKind):{rows:ImportRow[];issues:ImportIssue[]}{
 const spec=importSpecs[kind],headers=(grid[0]??[]).map(v=>String(v??"").trim());
 if(headers.join("\u001f")!==spec.headers.join("\u001f"))return {rows:[],issues:[{line:1,column:"Tiêu đề cột",message:"Giữ đúng các cột của mẫu: "+spec.headers.join("; ")}]};
 const rows:ImportRow[]=[],issues:ImportIssue[]=[],seen=new Set<string>();
 const data=grid.slice(1).map((row,i)=>({row,i})).filter(({row})=>row.some(v=>v!==null&&String(v).trim()!==""));
 if(!data.length)return {rows:[],issues:[{line:2,column:"Dữ liệu",message:"Tệp chưa có dòng dữ liệu."}]};
 if(data.length>500)return {rows:[],issues:[{line:2,column:"Dữ liệu",message:"Tối đa 500 dòng mỗi lần nhập; hãy tách tệp."}]};
 for(const {row,i} of data){
  let col=0;const cell=(n:number)=>{col=n;return String(row[n]??"").trim();};
  try{
   if(row.length>headers.length && row.slice(headers.length).some(v=>v!==null&&String(v).trim()!==""))throw Error("Có dữ liệu ngoài các cột của mẫu.");
   let r:ImportRow;
   if(kind==="equipment"){
    const d=new FormData();d.set("workspace","00000000-0000-0000-0000-000000000001");d.set("request_key","00000000-0000-4000-8000-000000000001");
    const fields=["code","name","category","base_status","serial","year","aliases","notes"];
    fields.forEach((k,n)=>{let v=cell(n);if(k==="category")v=Object.entries(categoryLabels).find(([key,label])=>key===v||label===v)?.[0]??v;if(k==="base_status")v=Object.entries(baseStatusLabels).find(([key,label])=>key===v||label===v)?.[0]??v;d.set(k,v);});
    const v=parseCatalogForm(d);r={code:v.code,name:v.name,category:v.category,base_status:v.base_status,serial:v.serial,year:v.year,aliases:v.aliases,notes:v.notes};
   }else if(kind==="materials"||kind==="cargo"){
    const c=code(cell(0)),name=text(cell(1));let unit=text(cell(2),40);
    if(kind==="cargo"){unit=Object.entries(cargoUnitLabels).find(([k,v])=>k===unit||v===unit.toLowerCase())?.[0]??unit;unit=z.enum(["TONNE","M3","ITEM","TRIP"]).parse(unit);}
    r={code:c,name,unit};
   }
   else{
    const equipment_code=code(cell(0)),m=month(cell(1));
    if(kind==="hours")r=hoursRows.parse([{equipment_code,month:m,operating_hours:number(cell(2),2)}])[0];
    else if(kind==="container"){const n=cell(2);if(!/^\d+$/.test(n))throw Error("Số container phải là số nguyên không âm, không để trống.");r=containerRows.parse([{equipment_code,month:m,boxes:Number(n)}])[0];}
    else r=otherRows.parse([{equipment_code,month:m,cargo_code:code(cell(2)),quantity:number(cell(3),3)}])[0];
   }
   const key=String(r.code??r.equipment_code)+"|"+String(r.month??"")+"|"+String(r.cargo_code??"");
   if(seen.has(key))throw Error("Trùng khóa dữ liệu với một dòng trước trong tệp; không tự cộng hai dòng.");seen.add(key);rows.push(r);
  }catch(error){
   if(error instanceof z.ZodError && kind==="equipment")col=({code:0,name:1,category:2,base_status:3,serial:4,year:5,aliases:6,notes:7} as Record<string,number>)[String(error.issues[0]?.path[0])]??col;
   issues.push({line:i+2,column:headers[col]??"Dữ liệu",message:error instanceof z.ZodError?"Giá trị thiếu hoặc không đúng quy định của cột này.":error instanceof Error?error.message:"Dữ liệu không hợp lệ."});
  }
 }
 return {rows,issues};
}
export function rowCells(row:ImportRow,kind:ImportKind):(string|number|null)[]{
 const fields=kind==="equipment"?["code","name","category","base_status","serial","year","aliases","notes"]:kind==="materials"||kind==="cargo"?["code","name","unit"]:kind==="hours"?["equipment_code","month","operating_hours"]:kind==="container"?["equipment_code","month","boxes"]:["equipment_code","month","cargo_code","quantity"];
 return fields.map(k=>{const v=row[k];if(k==="category")return categoryLabels[String(v) as keyof typeof categoryLabels]??String(v);if(k==="base_status")return baseStatusLabels[String(v) as keyof typeof baseStatusLabels]??String(v);if(k==="unit"&&kind==="cargo")return cargoUnitLabels[String(v)]??String(v);return Array.isArray(v)?v.join("; "):v??null;});
}
