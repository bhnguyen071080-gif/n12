export type MonthlyActivity={equipment_id:string;equipment_code:string;month:string;operating_hours:number|null;boxes:number|null};
export type MonthlyEquipment={id:string;code:string;category:string};

export function monthKeys(from:string,to:string):string[]{
 if(!/^\d{4}-\d{2}$/.test(from)||!/^\d{4}-\d{2}$/.test(to)||from>to)throw new Error("Khoảng tháng không hợp lệ");
 const result:string[]=[],cursor=new Date(`${from}-01T00:00:00Z`),end=`${to}-01`;
 while(cursor.toISOString().slice(0,10)<=end){result.push(cursor.toISOString().slice(0,7));cursor.setUTCMonth(cursor.getUTCMonth()+1);if(result.length>120)throw new Error("Bảng tổng hợp tối đa 120 tháng");}
 return result;
}

export function buildMonthlyMatrix(equipment:MonthlyEquipment[],activity:MonthlyActivity[],months:string[]){
 const values=new Map(activity.map(row=>[`${row.equipment_id}|${row.month.slice(0,7)}`,{hours:row.operating_hours===null?null:Number(row.operating_hours),boxes:row.boxes===null?null:Number(row.boxes)}]));
 const rows=equipment.map(machine=>({equipment:machine,cells:months.map(month=>values.get(`${machine.id}|${month}`)??{hours:null,boxes:null})}));
 const totals=months.map((month,index)=>{const cells=rows.map(row=>row.cells[index]);return {month,hours:cells.reduce((sum,cell)=>sum+(cell.hours??0),0),boxes:cells.reduce((sum,cell)=>sum+(cell.boxes??0),0),reported:cells.filter(cell=>cell.hours!==null).length,missing:cells.filter(cell=>cell.hours===null).length};});
 const years=[...new Set(months.map(month=>month.slice(0,4)))].map(year=>{const indexes=months.map((month,index)=>month.startsWith(year)?index:-1).filter(index=>index>=0);return {year,hours:rows.reduce((sum,row)=>sum+indexes.reduce((part,index)=>part+(row.cells[index].hours??0),0),0),boxes:rows.reduce((sum,row)=>sum+indexes.reduce((part,index)=>part+(row.cells[index].boxes??0),0),0),missing:rows.reduce((sum,row)=>sum+indexes.filter(index=>row.cells[index].hours===null).length,0)};});
 return {rows,totals,years};
}

