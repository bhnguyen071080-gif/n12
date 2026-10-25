import {z} from "zod";
import {categoryLabels,equipmentCategories} from "./equipment-catalog";
export const materialCategoryLabels:Record<string,string>={COMMON:"Dùng chung",...categoryLabels};
export const materialCategory=z.enum(["COMMON",...equipmentCategories]);
export function parseMaterialCategory(value:string){
 const v=value.trim();if(!v||v==="Chưa phân loại")return null;
 return materialCategory.parse(Object.entries(materialCategoryLabels).find(([k,label])=>k===v||label===v)?.[0]??v);
}
export type MaterialCatalogRow={id:string;code:string;name:string;unit:string;equipment_category:string|null;service_limit_hours:number|null};

export type MaterialIdentityRow=Pick<MaterialCatalogRow,"code"|"name"|"unit"|"equipment_category">;
export function normalizeMaterialIdentity(value:string){
 return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/gi,"d").toLowerCase().replace(/[^a-z0-9]+/g,"");
}
export function materialEquipmentGroup(row:Pick<MaterialIdentityRow,"code"|"equipment_category">){
 if(row.equipment_category)return row.equipment_category;
 return /^VT-([A-Z0-9]+)-/i.exec(row.code.trim())?.[1]?.toUpperCase()??"UNCLASSIFIED";
}
export function materialIdentityKey(row:MaterialIdentityRow){
 return [materialEquipmentGroup(row),normalizeMaterialIdentity(row.name),normalizeMaterialIdentity(row.unit)].join("|");
}
export function materialDuplicateGroups<T extends MaterialIdentityRow>(rows:T[]){
 const groups=new Map<string,T[]>();
 for(const row of rows){const key=materialIdentityKey(row);groups.set(key,[...(groups.get(key)??[]),row]);}
 return [...groups.values()].filter(group=>group.length>1);
}

