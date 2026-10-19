import type {SupabaseClient} from "@supabase/supabase-js";
import type {Database} from "./database";
import {snapshotSchema,type DocumentPayload} from "./documents";
export type MinutesDefaults=Pick<DocumentPayload,"company"|"department"|"unit"|"participants">;
export async function minutesDefaults(client:SupabaseClient<Database>,workspaceId:string):Promise<MinutesDefaults|undefined>{
 const result=await client.from("case_documents").select("snapshot").eq("workspace_id",workspaceId).eq("kind","condition_minutes").order("created_at",{ascending:false}).limit(1).maybeSingle();
 if(result.error||!result.data)return undefined;
 const parsed=snapshotSchema.safeParse(result.data.snapshot);if(!parsed.success)return undefined;
 const {company,department,unit,participants}=parsed.data.payload;
 // Deliberately exclude findings, dates, equipment, location and case numbers.
 return {company,department,unit,participants};
}
