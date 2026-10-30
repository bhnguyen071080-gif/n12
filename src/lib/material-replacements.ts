import {z} from "zod";
import {numeric,uuid} from "./domain";

export const materialReplacementSchema=z.object({
 equipment_id:uuid,equipment_code:z.string(),equipment_name:z.string(),material_id:uuid,material_code:z.string(),material_name:z.string(),unit:z.string(),
 usage_id:uuid,quantity:numeric,position:z.string(),replaced_on:z.string(),previous_replaced_on:z.string().nullable(),days_since_previous:numeric.nullable(),
 case_id:uuid.nullable(),case_code:z.string().nullable(),order_code:z.string(),item_id:uuid,total_count:numeric
});
export type MaterialReplacement=z.infer<typeof materialReplacementSchema>;

export function replacementStats(rows:MaterialReplacement[]){
 const repeated=rows.filter(row=>row.previous_replaced_on!==null);
 const intervals=repeated.map(row=>row.days_since_previous).filter((value):value is number=>value!==null);
 return {
  total:rows[0]?.total_count??0,
  equipment:new Set(rows.map(row=>row.equipment_id)).size,
  materials:new Set(rows.map(row=>row.material_id)).size,
  repeated:repeated.length,
  averageDays:intervals.length?Math.round(intervals.reduce((sum,value)=>sum+value,0)/intervals.length):null
 };
}

