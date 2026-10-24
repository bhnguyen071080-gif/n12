import type {Equipment} from "./domain";
export type EquipmentCard=
 Pick<Equipment,"id"|"workspace_id"|"code"|"name"|"status"> &
 Partial<Pick<Equipment,"category"|"serial_number"|"manufacture_year"|"accumulated_hours">>;
function searchable(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLocaleLowerCase("vi");}
export function filterEquipment(equipment:EquipmentCard[],query:string,status:string){
 const term=searchable(query.trim());
 return equipment.filter(e=>(!status || e.status===status) && (!term || searchable(e.code+" "+e.name).includes(term)));
}
export function equipmentCounts(equipment:EquipmentCard[]){
 return {total:equipment.length,available:equipment.filter(e=>e.status==="available").length,repair:equipment.filter(e=>e.status==="in_repair" || e.status==="maintenance").length};
}
