export const warrantyStateLabels={active:"Còn hạn",due_soon:"Gần tới",expired:"Hết hạn"} as const;
export type WarrantyState=keyof typeof warrantyStateLabels;

function parseDate(value:string):[number,number,number]{
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);if(!match)throw new Error("Ngày phải theo dạng YYYY-MM-DD");
 const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
 const date=new Date(Date.UTC(year,month-1,day));
 if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)throw new Error("Ngày không hợp lệ");
 return [year,month,day];
}

export function addWarrantyMonths(signedOn:string,months:number):string{
 const [year,month,day]=parseDate(signedOn);if(!Number.isInteger(months)||months<0||months>120)throw new Error("Thời gian bảo hành không hợp lệ");
 const target=month-1+months,targetYear=year+Math.floor(target/12),targetMonth=((target%12)+12)%12;
 const lastDay=new Date(Date.UTC(targetYear,targetMonth+1,0)).getUTCDate(),result=new Date(Date.UTC(targetYear,targetMonth,Math.min(day,lastDay)));
 return result.toISOString().slice(0,10);
}

export function warrantyState(endsOn:string,today:string):WarrantyState{
 const end=parseDate(endsOn),now=parseDate(today),endTime=Date.UTC(end[0],end[1]-1,end[2]),nowTime=Date.UTC(now[0],now[1]-1,now[2]);
 if(endTime<nowTime)return "expired";
 return (endTime-nowTime)/86400000<=30?"due_soon":"active";
}

export function formatDateVi(value:string|null):string{
 if(!value)return "—";const [year,month,day]=parseDate(value);return `${String(day).padStart(2,"0")}/${String(month).padStart(2,"0")}/${year}`;
}

export type ContractorMaterialRow={
 id:string;workspace_id:string;equipment_id:string;material_name:string;unit:string;quantity:number;contractor_name:string;
 signed_on:string;warranty_months:number;warranty_ends_on:string;notes:string;created_at:string;equipment_code:string;equipment_name:string;
};

