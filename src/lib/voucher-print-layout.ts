export type VoucherCopyFormat="two-up-a5"|"full-a4";

export type VoucherPrintLayout={
 format:VoucherCopyFormat;
 copySize:"A5"|"A4";
 copies:2;
 pagesPerCopy:number;
 sheets:number;
 chunks:number[][];
 label:string;
};

type LayoutInput={
 lineLabels:readonly string[];
 equipmentLabels?:readonly string[];
 contextText?:string;
};

function lineUnits(value:string){
 const normalized=value.trim().replace(/\s+/g," ");
 return Math.max(1,Math.ceil(normalized.length/42));
}

function splitByCapacity(labels:readonly string[],capacity:number){
 const chunks:number[][]=[];let chunk:number[]=[],used=0;
 labels.forEach((label,index)=>{
  const units=lineUnits(label);
  if(chunk.length&&used+units>capacity){chunks.push(chunk);chunk=[];used=0;}
  chunk.push(index);used+=units;
 });
 if(chunk.length)chunks.push(chunk);
 return chunks.length?chunks:[[]];
}

/**
 * Chọn khuôn in trước khi lưu. Mỗi phiếu luôn có hai liên giống nhau:
 * - nội dung ngắn: hai liên A5 trên một tờ A4;
 * - nội dung dài: mỗi liên dùng một hay nhiều trang A4.
 *
 * Hàm chỉ dùng dữ liệu hiển thị nên chạy giống nhau trong browser và server.
 * Ngưỡng A5 cố ý thận trọng để không ép chữ hoặc vùng ký tên.
 */
export function chooseVoucherPrintLayout({lineLabels,equipmentLabels=[],contextText=""}:LayoutInput):VoucherPrintLayout{
 const equipmentText=equipmentLabels.join(", ");
 const headerPenalty=Math.max(0,Math.ceil(equipmentText.length/72)-1)+Math.max(0,Math.ceil(contextText.trim().length/180)-1);
 const a5Capacity=Math.max(2,4-headerPenalty);
 const units=lineLabels.reduce((sum,label)=>sum+lineUnits(label),0);
 if(units<=a5Capacity){
  return {format:"two-up-a5",copySize:"A5",copies:2,pagesPerCopy:1,sheets:1,chunks:[lineLabels.map((_,index)=>index)],label:"2 liên A5 · 1 tờ A4"};
 }
 const a4Capacity=Math.max(8,18-headerPenalty*2),chunks=splitByCapacity(lineLabels,a4Capacity);
 return {format:"full-a4",copySize:"A4",copies:2,pagesPerCopy:chunks.length,sheets:chunks.length*2,chunks,label:`2 liên A4 · ${chunks.length*2} trang in`};
}

