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

export type MaterialQualityFilter=""|"duplicate"|"unclassified"|"with_limit"|"without_limit";
export type MaterialSort="name"|"code"|"category"|"limit";
export function materialCatalogStats(rows:MaterialCatalogRow[]){
 const duplicateIds=new Set(materialDuplicateGroups(rows).flatMap(group=>group.map(row=>row.id)));
 return {total:rows.length,categorized:rows.filter(row=>Boolean(row.equipment_category)).length,unclassified:rows.filter(row=>!row.equipment_category).length,withLimit:rows.filter(row=>row.service_limit_hours!==null).length,duplicateIds};
}
export function filterMaterialCatalog(rows:MaterialCatalogRow[],options:{query:string;category:string;quality:MaterialQualityFilter;sort:MaterialSort}){
 const term=normalizeMaterialIdentity(options.query.trim()),stats=materialCatalogStats(rows);
 const filtered=rows.filter(row=>{
  if(options.category==="unknown"&&row.equipment_category)return false;
  if(options.category&&options.category!=="unknown"&&row.equipment_category!==options.category)return false;
  if(term&&!normalizeMaterialIdentity([row.code,row.name,row.unit,row.equipment_category?materialCategoryLabels[row.equipment_category]??row.equipment_category:"Chưa phân loại"].join(" ")).includes(term))return false;
  if(options.quality==="duplicate"&&!stats.duplicateIds.has(row.id))return false;
  if(options.quality==="unclassified"&&row.equipment_category)return false;
  if(options.quality==="with_limit"&&row.service_limit_hours===null)return false;
  if(options.quality==="without_limit"&&row.service_limit_hours!==null)return false;
  return true;
 });
 return [...filtered].sort((a,b)=>{
  if(options.sort==="code")return a.code.localeCompare(b.code,"vi",{numeric:true});
  if(options.sort==="category")return (a.equipment_category??"ZZZ").localeCompare(b.equipment_category??"ZZZ","vi")||a.name.localeCompare(b.name,"vi",{numeric:true});
  if(options.sort==="limit")return (b.service_limit_hours??-1)-(a.service_limit_hours??-1)||a.name.localeCompare(b.name,"vi",{numeric:true});
  return a.name.localeCompare(b.name,"vi",{numeric:true});
 });
}

