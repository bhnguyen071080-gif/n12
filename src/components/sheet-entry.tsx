"use client";
import {useState} from "react";
import {z} from "zod";
import {saveGoogleSheet,saveSheetSource} from "@/app/actions";
import {AsyncForm} from "./async-form";
const sample=z.union([
 z.object({equipment_code:z.string(),month:z.string(),boxes:z.number()}).strict(),
 z.object({equipment_code:z.string(),month:z.string(),operating_hours:z.number()}).strict()
]);
const previewSchema=z.object({sourceId:z.string().uuid(),kind:z.enum(["container","hours"]),startMonth:z.string().nullable(),
 hash:z.string(),count:z.number(),sample:z.array(sample),unknownCodes:z.array(z.string()),
 issues:z.array(z.object({equipment_code:z.string(),month:z.string(),message:z.string()}))});
type Preview=z.infer<typeof previewSchema>;
type Source={id:string;name:string;source_kind:"container"|"hours"};
export function SheetEntry({workspace,sources}:{workspace:string;sources:Source[]}){
 const [source,setSource]=useState(sources[0]?.id??""),[kind,setKind]=useState<"container"|"hours">("container");
 const [preview,setPreview]=useState<Preview>(),[error,setError]=useState(""),[pending,setPending]=useState(false);
 async function read(){
  setPending(true);setError("");setPreview(undefined);
  try{const r=await fetch("/api/sheets/preview?source="+encodeURIComponent(source),{cache:"no-store"});
   const data:unknown=await r.json();if(!r.ok)throw new Error("Chưa đọc được nguồn; kiểm tra kết nối Viewer và cấu hình.");
   const result=previewSchema.parse(data);if(result.sourceId!==source)throw new Error("Kết quả không khớp nguồn đã chọn");setPreview(result);
  }catch(e){setError(e instanceof Error?e.message:"Không đọc được nguồn");}finally{setPending(false);}
 }
 return <div className="grid gap-5 lg:grid-cols-2"><section className="panel"><h2>Cập nhật từ tab TH</h2>
  <p>Đọc giá trị số gốc. Giờ máy có thể có phần thập phân; container là số chiếc nguyên. Bỏ dòng tổng/trung bình, giữ ô trống là chưa có dữ liệu. Không sửa file nguồn.</p>
  <label>Nguồn đã cấu hình<select value={source} disabled={pending} onChange={e=>{setSource(e.target.value);setPreview(undefined);}}>{sources.map(s=><option key={s.id} value={s.id}>{s.name} · {s.source_kind==="hours"?"Giờ hoạt động":"Container (chiếc)"}</option>)}</select></label>
  <button type="button" disabled={pending||!source} onClick={read}>{pending?"Đang đọc…":"Đọc nguồn & xem trước"}</button><p role="alert">{error}</p>
  {preview && <><p>{preview.count} dòng phương tiện/tháng · {preview.kind==="hours"?"Tổng giờ máy thực chạy; từ "+preview.startMonth?.slice(0,7):"Chỉ số container (chiếc), không quy đổi"}.</p>
   <pre className="overflow-x-auto text-xs">{JSON.stringify(preview.sample,null,2)}</pre>
   {preview.unknownCodes.length>0 && <p className="text-red-800">Chưa khớp danh mục: {preview.unknownCodes.join(", ")}. Cần ánh xạ hoặc bổ sung danh mục.</p>}
   {preview.issues.length>0 && <div role="alert" className="text-red-800"><p>Chưa thể nhập: {preview.issues.length} dòng giờ cần đối chiếu.</p>{preview.issues.slice(0,20).map(i=><p key={i.equipment_code+i.month}>{i.equipment_code} · {i.month.slice(0,7)}: {i.message}</p>)}</div>}
   {preview.unknownCodes.length===0 && preview.issues.length===0 &&
    <AsyncForm key={preview.sourceId+preview.hash} action={saveGoogleSheet} label="Xác nhận cập nhật cả lô"><input type="hidden" name="source" value={source}/><input type="hidden" name="preview_hash" value={preview.hash}/>
     {preview.kind==="hours" && <label><input type="checkbox" name="baseline_confirmed" required/> Tôi đã đối chiếu: số giờ đồng hồ ban đầu chỉ bao gồm thời gian trước tháng bắt đầu nhập, không chứa các tháng trong lô này.</label>}
    </AsyncForm>}
  </>}
 </section><section className="panel"><h2>Đăng ký nguồn (trưởng bộ phận)</h2>
  <p>Link lưu trong database có RLS, không đưa file hay dữ liệu nguồn vào GitHub công khai.</p>
  <AsyncForm action={saveSheetSource}><input type="hidden" name="workspace" value={workspace}/>
   <label>Loại dữ liệu<select name="source_kind" value={kind} onChange={e=>setKind(e.target.value==="hours"?"hours":"container")}><option value="container">Số container (chiếc)</option><option value="hours">Tổng giờ hoạt động tháng</option></select></label>
   <label>Tên nguồn<input name="name" required maxLength={100}/></label>
   <label>Link Google Sheets<input type="url" name="url" required placeholder="https://docs.google.com/spreadsheets/d/.../edit"/></label>
   <label>Vùng TH (hàng tên phương tiện bắt đầu A3)<input key={kind} name="a1_range" defaultValue={kind==="hours"?"A3:AR200":"A3:BH200"} required/></label>
   {kind==="hours" && <><label>Tháng bắt đầu nhập giờ<input name="start_month" type="month" required/></label><p>Chỉ nhập các tháng từ mốc này. Đối chiếu giờ đồng hồ ban đầu trước khi xác nhận để không cộng lại lịch sử.</p></>}
  </AsyncForm>
  <p>TH dạng ma trận: hàng 3 tên phương tiện, B năm, C tháng. Vùng mở rộng có giới hạn giúp đọc các tháng mới; bỏ dòng tổng và ô trống. Kết nối cần quyền Viewer, không cần Publish to web.</p>
 </section></div>;
}
