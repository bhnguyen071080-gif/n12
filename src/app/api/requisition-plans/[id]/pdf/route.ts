import {NextRequest,NextResponse} from "next/server";
import {configured,serverClient} from "@/lib/supabase";
import {uuid} from "@/lib/domain";
import {savedPlanVouchers,planVoucherPayload} from "@/lib/saved-requisition-plan";
import {renderPlanVoucherPdf} from "@/lib/document-pdf";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params,raw=request.nextUrl.searchParams.get("voucher")??"";
 if(!uuid.safeParse(id).success||!/^\d{1,3}$/.test(raw))return NextResponse.json({error:"Sai định danh phiếu"},{status:400});
 if(!configured())return NextResponse.json({error:"Chưa kết nối cloud"},{status:503});
 const client=await serverClient(),auth=await client.auth.getUser();
 if(auth.error||!auth.data.user)return NextResponse.json({error:"Cần đăng nhập"},{status:401});
 const r=await client.from("maintenance_requisition_runs").select("*").eq("id",id).maybeSingle();
 if(r.error)return NextResponse.json({error:"Không đọc được kế hoạch"},{status:503});
 if(!r.data)return NextResponse.json({error:"Không tìm thấy kế hoạch"},{status:404});
 try{
  const voucher=savedPlanVouchers(r.data)[Number(raw)];
  if(!voucher)return NextResponse.json({error:"Không tìm thấy phiếu"},{status:404});
  const pdf=await renderPlanVoucherPdf(planVoucherPayload(r.data,voucher),id,r.data.created_at);
  return new NextResponse(new Uint8Array(pdf),{headers:{"Content-Type":"application/pdf","Cache-Control":"private, no-store","Content-Disposition":`inline; filename="PL-${id}-${Number(raw)+1}.pdf"`}});
 }catch{return NextResponse.json({error:"Không tạo được PDF từ kế hoạch đã lưu"},{status:422});}
}
