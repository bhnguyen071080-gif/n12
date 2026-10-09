import {containerRows,hoursRows,equipmentCode} from "./domain";
// Adapter for a horizontal TH matrix: header row is first; year B, month C.
// Native API returns unformatted numeric values. Never parse display "1.234"
// as decimal 1.234, and never turn blank cells into zero.
export function thContainerRows(matrix:ReadonlyArray<ReadonlyArray<unknown>>,aliases:Record<string,string>={}){
 const header=matrix[0];if(!header)throw new Error("TH thiếu hàng tên phương tiện");
 const cols=header.map((v,col)=>({label:typeof v==="string"?v.trim():"",col})).filter(x=>x.col>=3 && x.label);
 if(!cols.length)throw new Error("TH chưa có cột phương tiện");
 const records:Array<{equipment_code:string;month:string;boxes:number}>=[];let year:number|undefined;
 const keys=new Set<string>(),codes=new Set<string>();
 const resolved=cols.map(({label,col})=>{
  const code=equipmentCode.parse(aliases[label]??label.toUpperCase().replace(/\s+/g,""));
  if(codes.has(code))throw new Error("Hai cột TH cùng ánh xạ một mã phương tiện");codes.add(code);return {code,col};
 });
 for(const row of matrix.slice(1)){
  if(typeof row[1]==="number" && Number.isInteger(row[1]) && row[1]>=2000 && row[1]<=2100)year=row[1];
  const match=typeof row[2]==="string"?/^Tháng\s+(\d{1,2})$/i.exec(row[2].trim()):null;
  if(!match)continue; // initialization errors, totals and averages are not monthly observations
  const month=Number(match[1]);if(!year || month<1 || month>12)throw new Error("TH có dòng tháng không rõ năm/tháng");
  for(const {code,col} of resolved){
   const value=row[col];if(value===undefined || value===null || value==="")continue;
   if(typeof value!=="number" || !Number.isSafeInteger(value) || value<0)throw new Error("TH có ô lỗi hoặc số container không hợp lệ");
   const date=year+"-"+String(month).padStart(2,"0")+"-01",key=code+"|"+date;
   if(keys.has(key))throw new Error("TH có dòng phương tiện/tháng trùng");keys.add(key);
   records.push({equipment_code:code,month:date,boxes:value});
  }
 }
 if(!records.length || records.length>10000)throw new Error("TH phải có 1–10.000 bản ghi tháng");
 // Validate with the same contract as imports, in safe-size batches.
 for(let offset=0;offset<records.length;offset+=1000)containerRows.parse(records.slice(offset,offset+1000));
 return records;
}

export function thHoursRows(matrix:ReadonlyArray<ReadonlyArray<unknown>>,aliases:Record<string,string>={},startMonth:string){
 if(!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(startMonth))throw new Error("Chọn tháng bắt đầu quản lý giờ máy");
 const header=matrix[0];if(!header)throw new Error("TH thiếu hàng tên phương tiện");
 const cols=header.map((v,col)=>({label:typeof v==="string"?v.trim():"",col})).filter(x=>x.col>=3 && x.label);
 if(!cols.length)throw new Error("TH chưa có cột phương tiện");
 const codes=new Set<string>(),keys=new Set<string>();let year:number|undefined;
 const resolved=cols.map(({label,col})=>{
  const code=equipmentCode.parse(aliases[label]??label.toUpperCase().replace(/\s+/g,""));
  if(codes.has(code))throw new Error("Hai cột TH cùng ánh xạ một mã phương tiện");codes.add(code);return {code,col};
 });
 const records:Array<{equipment_code:string;month:string;operating_hours:number}>=[];
 for(const row of matrix.slice(1)){
  if(typeof row[1]==="number" && Number.isInteger(row[1]) && row[1]>=2000 && row[1]<=2100)year=row[1];
  const match=typeof row[2]==="string"?/^Tháng\s+(\d{1,2})$/i.exec(row[2].trim()):null;
  if(!match)continue;
  const month=Number(match[1]);if(!year || month<1 || month>12)throw new Error("TH có dòng tháng không rõ năm/tháng");
  const date=year+"-"+String(month).padStart(2,"0")+"-01";if(date<startMonth)continue;
  for(const {code,col} of resolved){
   const value=row[col];if(value===undefined || value===null || value==="")continue;
   if(typeof value!=="number" || !Number.isFinite(value) || value<0)throw new Error("TH có ô lỗi hoặc giờ máy không hợp lệ");
   const key=code+"|"+date;if(keys.has(key))throw new Error("TH có dòng phương tiện/tháng trùng");keys.add(key);
   records.push({equipment_code:code,month:date,operating_hours:value});
  }
 }
 if(!records.length || records.length>10000)throw new Error("TH phải có 1–10.000 bản ghi giờ tháng trong phạm vi đã chọn");
 for(let offset=0;offset<records.length;offset+=1000)hoursRows.parse(records.slice(offset,offset+1000));
 return records;
}
export function hoursIssues(rows:ReadonlyArray<{equipment_code:string;month:string;operating_hours:number}>){
 return rows.flatMap(row=>{
  const year=Number(row.month.slice(0,4)),month=Number(row.month.slice(5,7));
  const maxHours=new Date(Date.UTC(year,month,0)).getUTCDate()*24;
  return row.operating_hours>maxHours?[{equipment_code:row.equipment_code,month:row.month,
   message:"Giờ hoạt động "+row.operating_hours+" vượt "+maxHours+" giờ của tháng lịch"}]:[];
 });
}
