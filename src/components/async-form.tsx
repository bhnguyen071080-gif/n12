"use client";
import {useRef,useState,type FormEvent,type ReactNode} from "react";
import type {ActionResult} from "@/app/actions";
import {createRequestKey} from "@/lib/request-key";
export function AsyncForm({action,children,prepare,onSuccess,onReset,onPendingChange,label="Lưu",resetOnNew=false,resetLabel="Nhập lần mới",showDefaultSubmit=true}:{
 action:(data:FormData)=>Promise<ActionResult>;children:ReactNode;
 prepare?:(data:FormData)=>void;onSuccess?:(result:ActionResult)=>void;onReset?:()=>void;onPendingChange?:(pending:boolean)=>void;label?:string;resetOnNew?:boolean;resetLabel?:string;showDefaultSubmit?:boolean
}){
 const [pending,setPending]=useState(false),[result,setResult]=useState<ActionResult>();
 const request=useRef<{fingerprint:string;key:string}|undefined>(undefined);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(pending)return;
  const data=new FormData(event.currentTarget);
  let phase:"prepare"|"request"|"save"="prepare";
  try{
   prepare?.(data);
   const fingerprint=JSON.stringify(Array.from(data.entries()).filter(([k])=>k!=="request_key"));
   if(request.current?.fingerprint!==fingerprint){phase="request";request.current={fingerprint,key:createRequestKey()};}
   data.set("request_key",request.current.key);setPending(true);onPendingChange?.(true);
   phase="save";
   const saved=await action(data);setResult(saved);if(saved.ok)onSuccess?.(saved);
  }catch(error){
   if(phase==="request")console.error("TV-EAM: chưa tạo được mã gửi",error instanceof Error?{name:error.name,message:error.message}:{name:"Unknown"});
   setResult({ok:false,message:phase==="request"?"Trình duyệt chưa tạo được mã gửi an toàn. Hãy tải lại trang hoặc dùng trình duyệt được cập nhật; chưa có dữ liệu nào được gửi.":"Chưa nhận được xác nhận lưu. Kiểm tra định dạng và kết nối; gửi lại cùng dữ liệu để thử lại."});
  }
  finally{setPending(false);onPendingChange?.(false);}
 }
 return <form onSubmit={submit} className="space-y-3">
  <fieldset disabled={pending || result?.ok} className="space-y-3">{children}{showDefaultSubmit?<button type="submit">{pending?"Đang lưu…":label}</button>:null}</fieldset>
  <p role="status" aria-live="polite" className={result?.ok?"text-emerald-800":"text-red-800"}>{result?.message}</p>
  {result?.ok && <button type="button" onClick={event=>{if(resetOnNew)event.currentTarget.form?.reset();request.current=undefined;setResult(undefined);onReset?.();}}>{resetLabel}</button>}
 </form>;
}

