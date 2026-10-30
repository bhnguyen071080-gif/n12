"use client";
import {useEffect,useState} from "react";
export function DocumentPrintButton(){
 const [font,setFont]=useState<"loading"|"ready"|"missing">("loading");
 useEffect(()=>{let active=true;
  Promise.all([new FontFace("TVEAMLocalTimes",'local("Times New Roman")',{weight:"400"}).load(),new FontFace("TVEAMLocalTimes",'local("Times New Roman Bold")',{weight:"700"}).load()]).then(fonts=>{if(active){fonts.forEach(face=>document.fonts.add(face));setFont("ready");}}).catch(()=>{if(active)setFont("missing");});
  return ()=>{active=false;};
 },[]);
 return <div className="document-print-controls"><button type="button" disabled={font!=="ready"} onClick={()=>window.print()}>{font==="loading"?"Đang kiểm tra font…":"In / Lưu PDF · Times New Roman 13"}</button>
 <p role="status">{font==="missing"?"Máy này chưa có đủ font Times New Roman thường và đậm. Cài font hợp lệ trên máy rồi tải lại; hệ thống không tự thay bằng font khác.":"Chọn Lưu dưới dạng PDF hoặc máy in. Khổ A4, tỷ lệ 100%, tắt đầu trang/chân trang của trình duyệt."}</p></div>;
}
