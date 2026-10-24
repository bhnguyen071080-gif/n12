export const equipmentHistoryHeading="SỬA CHỮA, THAY THẾ, CẢI TẠO CÁC BỘ PHẬN CƠ CẤU CỦA MÁY TRỤC";

export type EquipmentHistoryRow={
 key:string;
 equipment:{id:string;code:string;name:string}|undefined;
 day:string;
 content:string;
};

export function equipmentHistoryTitle(code:string):string{
 return `${equipmentHistoryHeading} ${code}`;
}

export function groupEquipmentHistory(rows:EquipmentHistoryRow[],equipment:{id:string;code:string;name:string}[]){
 const byEquipment=new Map<string,EquipmentHistoryRow[]>();
 for(const row of rows){
  if(!row.equipment)continue;
  const current=byEquipment.get(row.equipment.id)??[];
  current.push(row);byEquipment.set(row.equipment.id,current);
 }
 return equipment.filter(item=>byEquipment.has(item.id)).map(item=>({equipment:item,rows:byEquipment.get(item.id)??[]}));
}

