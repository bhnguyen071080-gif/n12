import QRCode from "qrcode";
import {serverClient,configured} from "@/lib/supabase";
import {equipmentCode,quickUrl,uuid} from "@/lib/domain";
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{code:string}>}){
 if(!configured())return new Response("Chưa cấu hình Supabase",{status:503});
 const {code}=await params,url=new URL(request.url),workspace=url.searchParams.get("workspace");
 if(!equipmentCode.safeParse(code).success || !uuid.safeParse(workspace).success)return new Response("Sai mã/không gian dữ liệu",{status:400});
 const client=await serverClient(),user=await client.auth.getUser();if(!user.data.user)return new Response("Cần đăng nhập",{status:401});
 const equipment=await client.from("equipment").select("id").eq("workspace_id",workspace!).eq("code",code).maybeSingle();
 if(equipment.error || !equipment.data)return new Response("Không tìm thấy hoặc không có quyền",{status:404});
 try{
  const target=quickUrl(process.env.APP_BASE_URL??"",code,workspace!);
  const bytes=await QRCode.toBuffer(target,{type:"png",errorCorrectionLevel:"Q",margin:4,width:512});
  return new Response(new Uint8Array(bytes),{headers:{"Content-Type":"image/png","Cache-Control":"private, no-store","Content-Disposition":'inline; filename="'+code+'-QR.png"'}});
 }catch{return new Response("Chưa có APP_BASE_URL hợp lệ",{status:503});}
}
