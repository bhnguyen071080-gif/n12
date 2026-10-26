export const warrantyStateLabels={active:"Còn hạn bảo hành",due_soon:"Sắp tới hạn",expired:"Hết hạn bảo hành"} as const;
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

export const contractorImportHeaders=["STT","Tên vật tư","Đơn vị","Số lượng","Mã PT","Phương tiện","Ngày ký","Thời gian BH","Ghi chú","Dự kiến"] as const;
export type ContractorImportRow={line:number;source_no:string;material_name:string;unit:string;quantity:number;equipment_code:string;equipment_name:string;signed_on:string;warranty_months:number;notes:string};
export type ContractorImportIssue={line:number;column:string;message:string};

function importDay(value:string|number|null):string{
 if(typeof value==="number"){
  if(!Number.isInteger(value)||value<1||value>100000)throw new Error("Ngày Excel không hợp lệ");
  return new Date(Date.UTC(1899,11,30)+value*86400000).toISOString().slice(0,10);
 }
 const text=String(value??"").trim(),iso=/^(\d{4})-(\d{2})-(\d{2})$/.exec(text),vi=/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(text);
 const result=iso?`${iso[1]}-${iso[2]}-${iso[3]}`:vi?`${vi[3]}-${vi[2].padStart(2,"0")}-${vi[1].padStart(2,"0")}`:"";
 if(!result||Number.isNaN(Date.parse(result+"T00:00:00Z")))throw new Error("Ngày cần dạng dd/mm/yyyy hoặc yyyy-mm-dd");
 return result;
}

export function normalizeLookup(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/[^a-zA-Z0-9]/g,"").toUpperCase();}

export function parseContractorImportGrid(grid:(string|number|null)[][]):{rows:ContractorImportRow[];issues:ContractorImportIssue[]}{
 const headerIndex=grid.slice(0,10).findIndex(row=>contractorImportHeaders.every((header,index)=>String(row[index]??"").trim()===header));
 if(headerIndex<0)return {rows:[],issues:[{line:1,column:"Tiêu đề cột",message:"Không tìm thấy đúng hàng tiêu đề VT_DVSC: "+contractorImportHeaders.join("; ")}]};
 const rows:ContractorImportRow[]=[],issues:ContractorImportIssue[]=[];
 const data=grid.slice(headerIndex+1).map((row,index)=>({row,line:headerIndex+index+2})).filter(({row})=>row.slice(0,10).some(value=>String(value??"").trim()!==""));
 if(!data.length)return {rows:[],issues:[{line:headerIndex+2,column:"Dữ liệu",message:"Tệp chưa có dòng dữ liệu."}]};
 if(data.length>2000)return {rows:[],issues:[{line:headerIndex+2,column:"Dữ liệu",message:"Tối đa 2.000 dòng mỗi lần nhập."}]};
 for(const {row,line} of data){
  try{
   const text=(index:number,max:number,required=true)=>{const value=String(row[index]??"").trim();if((required&&!value)||value.length>max)throw new Error(required?"Không được để trống hoặc vượt độ dài cho phép":"Vượt độ dài cho phép");return value;};
   const rawQuantity=String(row[3]??"").trim().replace(",","."),rawMonths=String(row[7]??"").trim();
   if(!/^\d+(?:\.\d{1,3})?$/.test(rawQuantity)||Number(rawQuantity)<=0)throw new Error("Số lượng phải lớn hơn 0, tối đa 3 số lẻ");
   if(rawMonths&&!/^\d+$/.test(rawMonths))throw new Error("Thời gian bảo hành phải là số tháng nguyên");
   const warranty=rawMonths?Number(rawMonths):0;if(warranty>120)throw new Error("Thời gian bảo hành tối đa 120 tháng");
   rows.push({line,source_no:text(0,50),material_name:text(1,300),unit:text(2,40),quantity:Number(rawQuantity),equipment_code:text(4,80,false),equipment_name:text(5,200,false),signed_on:importDay(row[6]??null),warranty_months:warranty,notes:text(8,1000,false)});
  }catch(error){issues.push({line,column:"Dữ liệu",message:error instanceof Error?error.message:"Dữ liệu không hợp lệ"});}
 }
 return {rows,issues};
}

