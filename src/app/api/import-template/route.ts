import {importTemplateBase64} from "@/lib/import-template.generated";
export const runtime="nodejs";
export async function GET(){
 return new Response(Buffer.from(importTemplateBase64,"base64"),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":"attachment; filename=\"tv-eam-bieu-mau-nhap-du-lieu.xlsx\"","Cache-Control":"private, no-store"}});
}
