"use client";
import {useState} from "react";
import {z} from "zod";
import {saveGoogleSheet,saveSheetSource} from "@/app/actions";
import {AsyncForm} from "./async-form";
const previewSchema=z.object({sourceId:z.string().uuid(),hash:z.string(),count:z.number(),sample:z.array(z.object({equipment_code:z.string(),month:z.string(),boxes:z.number()})),unknownCodes:z.array(z.string())});
type Preview=z.infer<typeof previewSchema>;
export function SheetEntry({workspace,sources}:{workspace:string;sources:{id:string;name:string}[]}){
 const [source,setSource]=useState(sources[0]?.id??""),[preview,setPreview]=useState<Preview>(),[error,setError]=useState(""),[pending,setPending]=useState(false);
 async function read(){
  setPending(true);setError("");setPreview(undefined);
  try{const r=await fetch("/api/sheets/preview?source="+encodeURIComponent(source),{cache:"no-store"});
   const data:unknown=await r.json();if(!r.ok)throw new Error("Chưa đọc được nguồn; kiểm tra kết nối Viewer và cấu hình.");
   const result=previewSchema.parse(data);if(result.sourceId!==source)throw new Error("Kết quả không khớp nguồn đã chọn");setPreview(result);
  }catch(e){setError(e instanceof Error?e.message:"Không đọc được nguồn");}finally{setPending(false);}
 }
 return <div className="grid gap-5 lg:grid-cols-2"><section className="panel"><h2>Cập nhật từ tab TH</h2><p>Đọc số nguyên gốc, không đọc dấu phân tách hàng nghìn. Bỏ dòng tổng/khởi tạo lỗi, giữ ô trống là chưa có dữ liệu. Không sửa file nguồn.</p>
  <label>Nguồn đã cấu hình<select value={source} disabled={pending} onChange={e=>{setSource(e.target.value);setPreview(undefined);}}>{sources.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
  <button type="button" disabled={pending||!source} onClick={read}>{pending?"Đang đọc…":"Đọc nguồn & xem trước"}</button><p role="alert">{error}</p>
  {preview && <><p>{preview.count} dòng phương tiện/tháng. Chỉ ghi nhận số container (chiếc), không quy đổi.</p>
   <pre className="overflow-x-auto text-xs">{JSON.stringify(preview.sample,null,2)}</pre>
   {preview.unknownCodes.length>0?<p className="text-red-800">Chưa khớp danh mục: {preview.unknownCodes.join(", ")}. Cần ánh xạ hoặc bổ sung danh mục trước khi nhập.</p>:
    <AsyncForm key={preview.sourceId+preview.hash} action={saveGoogleSheet} label="Xác nhận cập nhật cả lô"><input type="hidden" name="source" value={source}/><input type="hidden" name="preview_hash" value={preview.hash}/></AsyncForm>}
  </>}
 </section><section className="panel"><h2>Đăng ký nguồn (trưởng bộ phận)</h2><p>Link lưu trong database có RLS, không đưa file hay dữ liệu nguồn vào GitHub công khai. Chỉ nhập nguồn của chi nhánh này.</p>
  <AsyncForm action={saveSheetSource}><input type="hidden" name="workspace" value={workspace}/><label>Tên nguồn<input name="name" required maxLength={100}/></label>
  <label>Link Google Sheets<input type="url" name="url" required placeholder="https://docs.google.com/spreadsheets/d/.../edit"/></label></AsyncForm>
  <p>Adapter hiện dành cho TH dạng ma trận: hàng 3 tên phương tiện, cột B năm, cột C tháng. Bộ kết nối đọc cần được chủ file cấp Viewer; không yêu cầu Publish to web.</p>
 </section></div>;
}
