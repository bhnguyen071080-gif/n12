import {containerRows,hoursRows,otherRows,monthStart,type MonthlyKind} from "./domain";
export function parseCsv(text:string):string[][] {
 if(text.length>262144) throw new Error("CSV tối đa 256 KiB");
 const rows:string[][]=[];let row:string[]=[];let cell="";let quoted=false;let afterQuote=false;
 text=text.replace(/^\uFEFF/,"");
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"' && text[i+1]==='"'){cell+='"';i++;}
   else if(c==='"'){quoted=false;afterQuote=true;}else cell+=c;continue;}
  if(c==='"'){if(cell || afterQuote)throw new Error("Dấu nháy CSV không hợp lệ");quoted=true;}
  else if(c===","){row.push(cell);cell="";afterQuote=false;}
  else if(c==="\n" || c==="\r"){if(c==="\r" && text[i+1]==="\n")i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell="";afterQuote=false;}
  else {if(afterQuote)throw new Error("Ký tự sau dấu nháy CSV");cell+=c;}
 }
 if(quoted)throw new Error("CSV thiếu dấu nháy kết thúc");
 row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows;
}
export function monthlyCsv(text:string,kind:MonthlyKind){
 const rows=parseCsv(text),headers=rows.shift()?.map(x=>x.trim());
 const expected=kind==="hours"?["equipment_code","month","operating_hours"]:kind==="container"?["equipment_code","month","boxes"]:["equipment_code","month","cargo_code","quantity"];
 if(!headers || headers.join(",")!==expected.join(","))throw new Error("Header phải là: "+expected.join(","));
 const number=(x:string)=>{if(!/^\d+(\.\d+)?$/.test(x))throw new Error("Số dùng dấu chấm thập phân, không để trống");return Number(x);};
 const values=rows.map(r=>{
  if(r.length!==expected.length)throw new Error("Sai số cột CSV");
  const code=r[0].trim(),month=monthStart(r[1].trim().slice(0,7));
  if(!/^\d{4}-\d{2}(-01)?$/.test(r[1].trim()))throw new Error("Tháng CSV phải là YYYY-MM hoặc YYYY-MM-01");
  if(kind==="hours")return {equipment_code:code,month,operating_hours:number(r[2].trim())};
  if(kind==="container")return {equipment_code:code,month,boxes:number(r[2].trim())};
  return {equipment_code:code,month,cargo_code:r[2].trim(),quantity:number(r[3].trim())};
 });
 if(kind==="hours")return hoursRows.parse(values);if(kind==="container")return containerRows.parse(values);return otherRows.parse(values);
}
export function csvOutput(headers:string[],rows:ReadonlyArray<ReadonlyArray<string|number|null>>):string {
 const encode=(v:string|number|null)=>{let s=v===null?"":String(v);if(typeof v==="string" && /^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 return "\uFEFF"+[headers,...rows].map(row=>row.map(encode).join(",")).join("\r\n");
}
