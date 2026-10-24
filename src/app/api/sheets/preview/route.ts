import {serverClient,configured} from "@/lib/supabase";
import {uuid} from "@/lib/domain";
import {previewSource} from "@/lib/google-sheets";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 if(!configured())return Response.json({error:"Chưa cấu hình Supabase"},{status:503});
 const source=uuid.safeParse(new URL(request.url).searchParams.get("source"));if(!source.success)return Response.json({error:"Sai nguồn"},{status:400});
 const client=await serverClient(),user=await client.auth.getUser();if(!user.data.user)return Response.json({error:"Cần đăng nhập"},{status:401});
 const result=await client.from("sheet_sources").select("*").eq("id",source.data).single();if(result.error)return Response.json({error:"Không có quyền nguồn"},{status:404});
 try{
  const preview=await previewSource(result.data);
  const equipment=await client.from("equipment").select("code").eq("workspace_id",preview.workspace);if(equipment.error)throw new Error("Không đọc danh mục");
  const codes=new Set(equipment.data?.map(e=>e.code)),unknownCodes=[...new Set(preview.rows.map(r=>r.equipment_code).filter(c=>!codes.has(c)))];
  return Response.json({sourceId:preview.sourceId,kind:preview.kind,startMonth:preview.startMonth,issues:preview.issues,hash:preview.hash,count:preview.rows.length,sample:preview.rows.slice(0,12),unknownCodes},{headers:{"Cache-Control":"private, no-store"}});
 }catch{return Response.json({error:"Chưa đọc được nguồn. Cần kết nối Google Sheets Viewer và đúng vùng TH."},{status:503});}
}
