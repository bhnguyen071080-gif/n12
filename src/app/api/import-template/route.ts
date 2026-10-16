import {importTemplateBase64} from "@/lib/import-template.generated";
import {materialTemplateBase64} from "@/lib/material-template.generated";
export const runtime="nodejs";
export async function GET(request:Request){
 const materials=new URL(request.url).searchParams.get("kind")==="materials";
 const filename=materials?"tv-eam-mau-vat-tu.xlsx":"tv-eam-bieu-mau-nhap-du-lieu.xlsx";
 return new Response(Buffer.from(materials?materialTemplateBase64:importTemplateBase64,"base64"),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":`attachment; filename="${filename}"`,"Cache-Control":"private, no-store"}});
}
