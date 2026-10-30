import type {Equipment} from "./domain";
export type EquipmentCard=
 Pick<Equipment,"id"|"workspace_id"|"code"|"name"|"status"> &
 Partial<Pick<Equipment,"category"|"serial_number"|"manufacture_year"|"accumulated_hours">>;
function searchable(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLocaleLowerCase("vi");}
function identityAliases(value:string){
 const words=searchable(value).replace(/[^a-z0-9]+/g," ").trim().split(/\s+/).filter(Boolean),aliases=new Set<string>();
 if(!words.length)return aliases;
 aliases.add(words.join(""));
 for(let index=1;index<words.length;index++){
  const suffix=words.slice(index).join("");
  if(/[a-z]/.test(suffix)&&/\d/.test(suffix))aliases.add(suffix);
 }
 return aliases;
}
export function createEquipmentIdentityMatcher<T extends {id:string;code:string;name:string}>(equipment:readonly T[]){
 const index=new Map<string,T|null>();
 for(const item of equipment)for(const alias of new Set([...identityAliases(item.code),...identityAliases(item.name)])){
  const prior=index.get(alias);
  index.set(alias,prior===undefined?item:prior===null||prior.id!==item.id?null:item);
 }
 return (...identifiers:string[]):T|undefined=>{
  const matches=new Map<string,T>();
  for(const identifier of identifiers)for(const alias of identityAliases(identifier)){
   const item=index.get(alias);if(item)matches.set(item.id,item);
  }
  return matches.size===1?matches.values().next().value:undefined;
 };
}
export function filterEquipment(equipment:EquipmentCard[],query:string,status:string){
 const term=searchable(query.trim());
 return equipment.filter(e=>(!status || e.status===status) && (!term || searchable(e.code+" "+e.name).includes(term)));
}
export function equipmentLabel(equipment:Pick<EquipmentCard,"code"|"name">){
 const name=equipment.name.trim(),code=equipment.code.trim();
 return searchable(name)===searchable(code)?name:`${name} (mã ${code})`;
}
export function equipmentCounts(equipment:EquipmentCard[]){
 return {total:equipment.length,available:equipment.filter(e=>e.status==="available").length,repair:equipment.filter(e=>e.status==="in_repair" || e.status==="maintenance").length};
}

