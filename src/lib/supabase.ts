import "server-only";
import {createServerClient} from "@supabase/ssr";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import type {Database} from "./database";
export function configured(){return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);}
export async function serverClient(){
 if(!configured())throw new Error("Supabase chưa được cấu hình");
 const jar=await cookies();
 return createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{
  cookies:{getAll:()=>jar.getAll(),setAll(values){try{for(const c of values)jar.set(c.name,c.value,c.options);}catch{/* Read-only rendering; proxy writes refreshed cookies and no-store headers. */}}},
  global:{fetch:(input,init)=>fetch(input,{...init,cache:"no-store"})}
 });
}
export async function session(next="/"){
 if(!configured())redirect("/setup");
 const client=await serverClient();const {data,error}=await client.auth.getUser();
 if(error || !data.user)redirect("/login?next="+encodeURIComponent(next));
 return {client,user:data.user};
}
export async function context(workspace?:string){
 const {client,user}=await session();
 const {data,error}=await client.from("workspaces").select("id,name").order("name");
 if(error)throw new Error("Không đọc được không gian dữ liệu");
 const workspaces=data??[], selected=workspaces.find(w=>w.id===workspace)??(!workspace?workspaces[0]:undefined);
 return {client,user,workspaces,workspace:selected};
}
