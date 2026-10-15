import {z} from "zod";
import {categoryLabels,equipmentCategories} from "./equipment-catalog";
export const materialCategoryLabels:Record<string,string>={COMMON:"Dùng chung",...categoryLabels};
export const materialCategory=z.enum(["COMMON",...equipmentCategories]);
export function parseMaterialCategory(value:string){
 const v=value.trim();if(!v||v==="Chưa phân loại")return null;
 return materialCategory.parse(Object.entries(materialCategoryLabels).find(([k,label])=>k===v||label===v)?.[0]??v);
}
export type MaterialCatalogRow={id:string;code:string;name:string;unit:string;equipment_category:string|null;service_limit_hours:number|null};
