import type {SupabaseClient} from "@supabase/supabase-js";
import type {Database} from "./database";
import {snapshotSchema,type DocumentPayload} from "./documents";
import {editorDocument,type SourceEnvelope} from "./document-source";
export type RequisitionBasis={id:string;revision:number;snapshot:unknown};
export async function requisitionBasis(client:SupabaseClient<Database>,caseId:string):Promise<RequisitionBasis|undefined>{
 const r=await client.from("case_documents").select("id,revision,snapshot").eq("case_id",caseId).eq("kind","condition_minutes").order("revision",{ascending:false}).limit(1).maybeSingle();
 return !r.error&&r.data?r.data:undefined;
}
export function prepareRequisition(env:SourceEnvelope,prior?:unknown,basis?:RequisitionBasis){
 const saved=snapshotSchema.safeParse(prior);
 const own=saved.success&&saved.data.source.case_id===env.data.source.case_id&&saved.data.payload.kind==="material_requisition";
 // Existing drafts retain all edited rows, even when tracking source has changed.
 const payload:DocumentPayload=own?structuredClone(saved.data.payload):editorDocument(env,"material_requisition").payload;
 if(!payload.voucher_template){payload.signer_names=[payload.signer_names[1],payload.signer_names[2],payload.signer_names[3],"",""];payload.voucher_template="bm0806";}
 const parsed=basis&&snapshotSchema.safeParse(basis.snapshot);
 if(!own&&basis&&parsed?.success&&parsed.data.payload.kind==="condition_minutes"&&parsed.data.source.case_id===env.data.source.case_id){
  const minutes=parsed.data.payload;
  payload.company=minutes.company;payload.department=minutes.department;payload.equipment_label=minutes.equipment_label;
  payload.basis_document_id=basis.id;
  payload.reason=`Phục vụ ${minutes.equipment_label}; căn cứ biên bản ${minutes.document_number||`v${basis.revision}`}.`.slice(0,1500);
  payload.lines=minutes.lines.map(line=>({...line,usage_id:null,issued:null,unit_price:null,limit_text:"",used_text:"",condition:"",notes:""}));
 }
 return {payload,sourceChanged:own&&saved.data.source_hash!==env.source_hash};
}
