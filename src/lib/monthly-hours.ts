import {z} from "zod";
import {localInputNow,monthStart,numeric} from "./domain";
export function previousMonth(value:string):string {
 monthStart(value);const y=Number(value.slice(0,4)),m=Number(value.slice(5,7));
 return m===1?String(y-1)+"-12":y+"-"+String(m-1).padStart(2,"0");
}
export function defaultEndMonth(hasData:boolean,now=new Date()):string {
 const month=localInputNow(now).slice(0,7);return hasData?month:previousMonth(month);
}
export function inclusiveRange(from:string,to:string):{from:string;to:string} {
 const a=monthStart(from),b=monthStart(to),n=(Number(to.slice(0,4))-Number(from.slice(0,4)))*12+Number(to.slice(5,7))-Number(from.slice(5,7));
 if(n<0||n>599)throw new Error("Khoảng tháng không hợp lệ (tối đa 600 tháng).");return {from:a,to:b};
}
export function actualDay(value:string):string {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<"2000-01-01")throw new Error("Ngày không hợp lệ.");
 const date=new Date(value+"T00:00:00+07:00");
 if(!Number.isFinite(date.getTime())||localInputNow(date).slice(0,10)!==value)throw new Error("Ngày không hợp lệ.");return value;
}
export const hourRow=z.object({month:z.string(),operating_hours:numeric.nullable()});
export function summarizeHours(rows:z.infer<typeof hourRow>[]):{total:number|null;missing:string[]} {
 const known=rows.filter(r=>r.operating_hours!==null);
 return {total:known.length?known.reduce((n,r)=>n+(r.operating_hours??0),0):null,missing:rows.filter(r=>r.operating_hours===null).map(r=>r.month.slice(0,7))};
}
export const monthLabel=(value:string)=>value.slice(5,7)+"/"+value.slice(0,4);
export const dayLabel=(value:string|null)=>value?value.slice(8,10)+"/"+value.slice(5,7)+"/"+value.slice(0,4):"Chưa ghi";
