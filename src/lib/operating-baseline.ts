import {z} from "zod";
import {monthStart} from "./domain";
const baselineInput=z.object({
 equipment:z.guid(),key:z.guid(),
 hours:z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number).refine(n=>n<=1000000000),
 start:z.string().regex(/^(20\d{2}|21\d{2})-(0[1-9]|1[0-2])$/).transform(monthStart),
 confirmed:z.literal(true),
});
export function parseBaselineForm(data:FormData){
 return baselineInput.parse({equipment:String(data.get("equipment")??""),key:String(data.get("request_key")??""),
  hours:String(data.get("initial_hours")??"").trim(),start:String(data.get("start_month")??""),confirmed:data.get("baseline_confirmed")==="on"});
}
