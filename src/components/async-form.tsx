"use client";
import {useRef,useState,type FormEvent,type ReactNode} from "react";
import type {ActionResult} from "@/app/actions";
export function AsyncForm({action,children,prepare,onSuccess,onReset,label="Lưu"}:{
 action:(data:FormData)=>Promise<ActionResult>;children:ReactNode;
 prepare?:(data:FormData)=>void;onSuccess?:(result:ActionResult)=>void;onReset?:()=>void;label?:string
}){
 const [pending,setPending]=useState(false),[result,setResult]=useState<ActionResult>();
 const request=useRef<{fingerprint:string;key:string}|undefined>(undefined);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(pending)return;
  const data=new FormData(event.currentTarget);
  try{
   prepare?.(data);
   const fingerprint=JSON.stringify(Array.from(data.entries()).filter(([k])=>k!=="request_key"));
   if(request.current?.fingerprint!==fingerprint)request.current={fingerprint,key:crypto.randomUUID()};
   data.set("request_key",request.current.key);setPending(true);
   const saved=await action(data);setResult(saved);if(saved.ok)onSuccess?.(saved);
  }catch{setResult({ok:false,message:"Chưa lưu được. Kiểm tra định dạng và kết nối; gửi lại cùng dữ liệu để thử lại."});}
  finally{setPending(false);}
 }
 return <form onSubmit={submit} className="space-y-3">
  <fieldset disabled={pending || result?.ok} className="space-y-3">{children}<button type="submit">{pending?"Đang lưu…":label}</button></fieldset>
  <p role="status" aria-live="polite" className={result?.ok?"text-emerald-800":"text-red-800"}>{result?.message}</p>
  {result?.ok && <button type="button" onClick={()=>{request.current=undefined;setResult(undefined);onReset?.();}}>Nhập lần mới</button>}
 </form>;
}
