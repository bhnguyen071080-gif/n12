import {createServerClient} from "@supabase/ssr";
import {NextResponse,type NextRequest} from "next/server";
import type {Database} from "@/lib/database";
export async function proxy(request:NextRequest){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 let response=NextResponse.next({request});
 response.headers.set("Cache-Control","private, no-store");
 if(!url || !key)return response;
 const client=createServerClient<Database>(url,key,{
  cookies:{getAll:()=>request.cookies.getAll(),setAll(values,headers){
   for(const c of values)request.cookies.set(c.name,c.value);
   response=NextResponse.next({request});
   for(const c of values)response.cookies.set(c.name,c.value,c.options);
   for(const [name,value] of Object.entries(headers??{}))response.headers.set(name,value);
   response.headers.set("Cache-Control","private, no-store");
  }}
 });
 await client.auth.getClaims();return response;
}
export const config={matcher:["/((?!_next/static|_next/image|icon.svg|sw.js|offline.html|manifest.webmanifest).*)"]};
