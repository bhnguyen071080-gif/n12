import {redirect} from "next/navigation";
import {context} from "@/lib/supabase";
import {importKinds,type ImportKind} from "@/lib/table-import";
import {importDestination} from "@/lib/import-placement";
export const dynamic="force-dynamic";
export default async function Imports({searchParams}:{searchParams:Promise<{workspace?:string;kind?:string}>}){
 const p=await searchParams,c=await context(p.workspace);if(!c.workspace)return <p>Chưa có quyền ở khu vực dữ liệu này.</p>;
 const kind=importKinds.includes(p.kind as ImportKind)?p.kind as ImportKind:"equipment";
 // Saved links open the import panel in its owning page, with the same workspace.
 redirect(importDestination(kind,c.workspace.id));
}
