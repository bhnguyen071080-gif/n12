import {z} from "zod";
import {uuid,numeric,localInputNow} from "./domain";
import {documentSourceSchema,snapshotSchema,inspectionLine,type DocumentPayload} from "./documents";

export const sourceEnvelopeSchema=z.object({workspace_id:uuid,source_hash:z.string().regex(/^[a-f0-9]{64}$/),data:z.object({
 source:documentSourceSchema,summary:z.string(),
 items:z.array(z.object({id:uuid,item_no:z.number(),version:z.number(),performed_on:z.string().nullable(),symptom:z.string(),root_cause:z.string(),solution_plan:z.string(),execution_result:z.string()})),
 lines:z.array(z.object({usage_id:uuid,item_id:uuid,item_no:z.number(),name:z.string(),code:z.string(),unit:z.string(),quantity:numeric,condition:z.string(),service_limit_hours:numeric.nullable()}))
})});
export type SourceEnvelope=z.infer<typeof sourceEnvelopeSchema>;
export function editorDocument(env:SourceEnvelope,kind:DocumentPayload["kind"],prior?:unknown):{payload:DocumentPayload;sourceChanged:boolean}{
 const parsed=snapshotSchema.safeParse(prior);
 const sameCase=parsed.success&&parsed.data.source.case_id===env.data.source.case_id&&parsed.data.payload.kind===kind;
 if(sameCase&&(kind==="condition_minutes"||parsed.data.source_hash===env.source_hash))return {payload:independentMinutes(parsed.data.payload),sourceChanged:parsed.data.source_hash!==env.source_hash};
 return {payload:prefillDocument(env,kind,sameCase?prior:undefined),sourceChanged:!!sameCase};
}
// Minutes are a document of the inspection, not editable material-usage transactions.
// Preserve old saved values, but detach usage IDs when preparing a new revision.
export function independentMinutes(payload:DocumentPayload):DocumentPayload{
 return payload.kind==="condition_minutes"?{...payload,lines:payload.lines.map(line=>({...line,usage_id:null}))}:payload;
}
export function prefillDocument(env:SourceEnvelope,kind:DocumentPayload["kind"],prior?:unknown):DocumentPayload{
 if(kind==="condition_minutes")return {
 schema_version:1,kind,company:"",department:"PHÒNG KỸ THUẬT",unit:"",location:"",form_code:"BM.12.06",document_number:"",document_at:"",
 equipment_label:`${env.data.source.equipment_name} (${env.data.source.equipment_code})`,inspection_subject:"",reason:"",warehouse:"",
 participants:[{unit:"Phòng Kỹ thuật",members:""},{unit:"Chi nhánh Cảng Tân Vũ",members:""}],cause:"",solution:"",signer_names:["","","","",""],amount_words:"",
 lines:[inspectionLine(env.data.source.equipment_name)]};
 const parsed=snapshotSchema.safeParse(prior),old=parsed.success?parsed.data.payload:undefined;
 const unique=(values:string[])=>[...new Set(values.filter(s=>s.trim()))].join("\n");
 const lines=env.data.lines.map(l=>({usage_id:l.usage_id,name:l.name,specification:"",catalogue_code:l.code,unit:l.unit,requested:l.quantity,
 issued:null,unit_price:null,limit_text:l.service_limit_hours===null?"":String(l.service_limit_hours)+" giờ",used_text:"",condition:l.condition,notes:""}));
 return {schema_version:1,kind,company:old?.company??"",department:old?.department??"",unit:old?.unit??"",location:old?.location??"",
 form_code:old?.form_code??"",document_number:"",document_at:localInputNow(),equipment_label:`${env.data.source.equipment_name} (${env.data.source.equipment_code})`,
 inspection_subject:env.data.summary,reason:env.data.summary,warehouse:old?.warehouse??"",
 participants:old?.participants??[{unit:"",members:""},{unit:"",members:""},{unit:"",members:""}],
 cause:unique(env.data.items.map(i=>i.root_cause)),solution:unique(env.data.items.map(i=>i.solution_plan)),
 signer_names:old?.signer_names??["","","","",""],amount_words:"",
 lines};
}
