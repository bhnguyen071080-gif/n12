import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {PDFDocument,PDFPage,PDFFont,rgb} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {snapshotSchema,issuedAmount,knownTotal,type DocumentSnapshot,type DocumentLine} from "./documents";
import {parseRepresentatives,representativeLabel,structuredRepresentatives} from "./document-people";

const MM=72/25.4,W=210*MM,H=297*MM,A5=H/2,BLACK=rgb(0,0,0);
type Fonts={regular:PDFFont;bold:PDFFont};
type Cell={lines:string[];align?:"left"|"center"|"right"};
export function wrapPdfText(value:string,font:PDFFont,size:number,width:number):string[]{
 const lines:string[]=[];
 for(const paragraph of value.replace(/\r/g,"").split("\n")){
  let line="";
  for(const word of paragraph.split(/\s+/).filter(Boolean)){
   const candidate=line?line+" "+word:word;
   if(font.widthOfTextAtSize(candidate,size)<=width){line=candidate;continue;}
   if(line){lines.push(line);line="";}
   if(font.widthOfTextAtSize(word,size)<=width){line=word;continue;}
   for(const ch of word){if(line&&font.widthOfTextAtSize(line+ch,size)>width){lines.push(line);line="";}line+=ch;}
  }
  lines.push(line);
 }
 return lines.length?lines:[""];
}
function drawText(page:PDFPage,text:string,x:number,y:number,size:number,font:PDFFont){
 if(text)page.drawText(text,{x,y,size,font,color:BLACK});
}
function centered(page:PDFPage,text:string,y:number,size:number,font:PDFFont,x=0,width=W){
 for(const [i,line] of wrapPdfText(text,font,size,width-8).entries())drawText(page,line,x+(width-font.widthOfTextAtSize(line,size))/2,y-i*(size+3),size,font);
}
function cellLines(value:string,font:PDFFont,size:number,width:number):string[]{return wrapPdfText(value,font,size,width-8);}
function mergedHeader(font:PDFFont,size:number,widths:number[],headings:string[],groupLabel:string){
 const cells=headings.map((t,i)=>({lines:cellLines(t,font,size,widths[i]),align:"center" as const}));
 const top=cellLines(groupLabel,font,size,widths[4]+widths[5]);
 const lowerHeight=Math.max(cells[4].lines.length,cells[5].lines.length)*(size+3)+8;
 const height=Math.max(top.length*(size+3)+8+lowerHeight,...cells.filter((_,i)=>i!==4&&i!==5).map(c=>c.lines.length*(size+3)+8));
 return {cells,top,lowerHeight,height};
}
function drawMergedHeader(page:PDFPage,x:number,y:number,widths:number[],head:ReturnType<typeof mergedHeader>,size:number,font:PDFFont){
 let left=x;
 widths.forEach((width,i)=>{
  if(i===4){tableRow(page,left,y,[widths[4]+widths[5]],[{lines:head.top,align:"center"}],head.height-head.lowerHeight,size,font);}
  if(i===4||i===5)tableRow(page,left,y-head.height+head.lowerHeight,[width],[head.cells[i]],head.lowerHeight,size,font);
  else tableRow(page,left,y,[width],[head.cells[i]],head.height,size,font);
  left+=width;
 });
}
function tableRow(page:PDFPage,x:number,y:number,widths:number[],cells:Cell[],height:number,size:number,font:PDFFont){
 let left=x;
 widths.forEach((width,i)=>{
  page.drawRectangle({x:left,y:y-height,width,height,borderWidth:.5,borderColor:BLACK});
  const lines=cells[i]?.lines??[""],lineHeight=size+3;
  const top=y-(height-lines.length*lineHeight)/2-size;
  lines.forEach((line,j)=>{const tw=font.widthOfTextAtSize(line,size),align=cells[i]?.align;
   drawText(page,line,left+(align==="center"?(width-tw)/2:align==="right"?width-tw-4:4),top-j*lineHeight,size,font);
  });left+=width;
 });
}
function number(n:number|null):string{return n===null?"":new Intl.NumberFormat("vi-VN",{maximumFractionDigits:3}).format(n);}
function day(value:string):string{return `ngày ${value.slice(8,10)} tháng ${value.slice(5,7)} năm ${value.slice(0,4)}`;}
export function voucherHeaderFields(documentAt:string,documentNumber:string){return {date:`Hải Phòng, ${day(documentAt)}`,number:`Số: ${documentNumber||"....."}`};}
async function fonts(doc:PDFDocument):Promise<Fonts>{
 doc.registerFontkit(fontkit);
 const [regular,bold]=await Promise.all([readFile(join(process.cwd(),"assets/fonts/NotoSerif-Regular.ttf")),readFile(join(process.cwd(),"assets/fonts/NotoSerif-Bold.ttf"))]);
 const [r,b]=await Promise.all([doc.embedFont(regular,{subset:true,customName:"TVSerif"}),doc.embedFont(bold,{subset:true,customName:"TVSerifBold"})]);
 return {regular:r,bold:b};
}
function metadata(doc:PDFDocument,s:DocumentSnapshot,createdAt:string){
 const date=new Date(createdAt);if(!Number.isFinite(date.getTime()))throw new Error("Ngày lưu không hợp lệ");
 doc.setCreationDate(date);doc.setModificationDate(date);doc.setCreator("TV-EAM");doc.setProducer("TV-EAM print-1");
 doc.setTitle(s.payload.kind==="condition_minutes"?"Biên bản xác định tình trạng kỹ thuật":"Phiếu lĩnh vật tư");
 doc.setSubject(s.source.case_code);
}
class MinutesFlow{
 page:PDFPage;y=H-28;readonly x=20*MM;readonly width=W-35*MM;
 constructor(readonly doc:PDFDocument,readonly f:Fonts,readonly s:DocumentSnapshot,readonly revision:number){this.page=this.newPage();}
 newPage():PDFPage{
  const page=this.doc.addPage([W,H]);
  drawText(page,`${this.s.source.case_code} · v${this.revision}`,20*MM,12,8,this.f.regular);
  drawText(page,`Trang ${this.doc.getPageCount()}`,W-95,12,8,this.f.regular);
  this.y=H-28;return page;
 }
 ensure(height:number){if(this.y-height<40)this.page=this.newPage();}
 paragraph(value:string,bold=false,size=11){
  const font=bold?this.f.bold:this.f.regular;
  for(const line of wrapPdfText(value,font,size,this.width)){this.ensure(size+4);drawText(this.page,line,this.x,this.y-size,size,font);this.y-=size+4;}
  this.y-=4;
 }
 center(value:string,size=12){const lines=wrapPdfText(value,this.f.bold,size,this.width);this.ensure(lines.length*(size+3)+5);centered(this.page,value,this.y-size,size,this.f.bold,this.x,this.width);this.y-=lines.length*(size+3)+5;}
}
function minutes(doc:PDFDocument,f:Fonts,s:DocumentSnapshot,revision:number){
 const d=s.payload,flow=new MinutesFlow(doc,f,s,revision),half=flow.width/2;
 if(d.form_code)drawText(flow.page,`Mẫu: ${d.form_code}`,W-15*MM-f.bold.widthOfTextAtSize(`Mẫu: ${d.form_code}`,8),H-15,8,f.bold);
 const left=[d.company,d.department,`Số: ${d.document_number||"................"}`];
 const right=["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM","Độc lập - Tự do - Hạnh phúc"];
 let lh=0,rh=0;
 left.forEach((text,i)=>{const font=i<2?f.bold:f.regular,lines=wrapPdfText(text,font,10,half-10);lines.forEach((line,j)=>drawText(flow.page,line,flow.x+(half-font.widthOfTextAtSize(line,10))/2,flow.y-lh-10-j*13,10,font));lh+=lines.length*13;});
 right.forEach((text,i)=>{const lines=wrapPdfText(text,f.bold,i===0?9:10,half-8);lines.forEach((line,j)=>drawText(flow.page,line,flow.x+half+(half-f.bold.widthOfTextAtSize(line,i===0?9:10))/2,flow.y-rh-10-j*13,i===0?9:10,f.bold));rh+=lines.length*13;});
 flow.y-=Math.max(lh,rh)+15;flow.center("BIÊN BẢN KIỂM TRA",14);flow.center("XÁC ĐỊNH TÌNH TRẠNG KỸ THUẬT CỦA PHƯƠNG TIỆN",11);flow.center(d.equipment_label,11);
 flow.paragraph(`Hôm nay, vào hồi ${d.document_at.slice(11,13)}h${d.document_at.slice(14,16)} ${day(d.document_at)}. Tại ${d.location}, chúng tôi gồm:`);
 d.participants.filter(p=>p.unit.trim()).forEach((p,i)=>{flow.paragraph(`${["I","II","III"][i]}. Đại diện ${p.unit}`,true);
  if(structuredRepresentatives(p.members))parseRepresentatives(p.members).forEach((person,j)=>{
   const widths=[flow.width*.55,flow.width*.45],names=wrapPdfText(`${j+1}. ${representativeLabel(person)}`,f.regular,11,widths[0]-8),titles=wrapPdfText(person.title,f.regular,11,widths[1]-8);
   const height=Math.max(names.length,titles.length)*15+4;flow.ensure(height);
   names.forEach((line,k)=>drawText(flow.page,line,flow.x,flow.y-11-k*15,11,f.regular));titles.forEach((line,k)=>drawText(flow.page,line,flow.x+widths[0],flow.y-11-k*15,11,f.regular));flow.y-=height;
  });else if(p.members)flow.paragraph(p.members);
 });
 flow.paragraph(`Cùng nhau kiểm tra, xác định tình trạng kỹ thuật ${d.inspection_subject||d.equipment_label} như sau:`);
 const widths=[.05,.21,.085,.08,.095,.095,.295,.09].map(v=>v*flow.width);
 const headings=["Stt","Tên vật tư, quy cách","Đơn vị tính","Số lượng","Định mức","Thực hiện","Tình trạng kỹ thuật","Ghi chú"];
 const head=mergedHeader(f.bold,9,widths,headings,"Định mức sử dụng"),headerHeight=head.height;
 const header=()=>{flow.ensure(headerHeight+22);drawMergedHeader(flow.page,flow.x,flow.y,widths,head,9,f.bold);flow.y-=headerHeight;};
 if(d.lines.length){header();d.lines.forEach((line,index)=>{
  const values=[String(index+1),[line.name,line.specification].filter(Boolean).join("\n"),line.unit,number(line.requested),line.limit_text,line.used_text,line.condition,line.notes];
  const cells=values.map((t,i)=>({lines:cellLines(t,f.regular,9,widths[i]),align:([0,2,3,4,5].includes(i)?"center":"left") as "left"|"center"}));
  let offset=0,total=Math.max(...cells.map(c=>c.lines.length));
  const fullHeight=total*12+8,freshHeight=H-28-headerHeight-40;
  if(fullHeight<=freshHeight&&flow.y-fullHeight<40){flow.page=flow.newPage();header();}
  while(offset<total){let capacity=Math.floor((flow.y-40-8)/12);if(capacity<1){flow.page=flow.newPage();header();capacity=Math.floor((flow.y-40-8)/12);}
   const count=Math.min(total-offset,capacity),chunk=cells.map(c=>({...c,lines:c.lines.slice(offset,offset+count)}));
   if(offset>0)chunk[0].lines=[String(index+1)];
   tableRow(flow.page,flow.x,flow.y,widths,chunk,count*12+8,9,f.regular);flow.y-=count*12+8;offset+=count;
   if(offset<total){flow.page=flow.newPage();header();}
  }
 });flow.y-=8;}
 flow.paragraph("Kết luận",true);flow.paragraph("Nguyên nhân: "+(d.cause||"................................"));
 flow.paragraph("Biện pháp khắc phục: "+(d.solution||"................................"));
 const groups=d.participants.filter(p=>p.unit.trim());if(groups.length){const col=flow.width/groups.length;
  const labels=groups.map(p=>wrapPdfText("ĐẠI DIỆN\n"+p.unit.toUpperCase(),f.bold,9,col-8)),height=Math.max(...labels.map(l=>l.length))*12+60;
  flow.ensure(height);labels.forEach((lines,i)=>{lines.forEach((line,j)=>drawText(flow.page,line,flow.x+i*col+(col-f.bold.widthOfTextAtSize(line,9))/2,flow.y-9-j*12,9,f.bold));
   if(structuredRepresentatives(groups[i].members)){const signer=parseRepresentatives(groups[i].members).find(person=>person.signs);if(signer)centered(flow.page,signer.name,flow.y-lines.length*12-40,10,f.bold,flow.x+i*col,col);}
  });
 }
}
type VoucherChunk={rows:{line:DocumentLine;index:number;cells:Cell[];height:number}[]};
export function voucherSignatureMetrics(titleLines:number,nameLines:number){
 const titleHeight=titleLines*11,captionOffset=titleHeight+8,blankHeight=21*MM;
 // Reserve a real 21 mm blank below the caption, above the printed name.
 const nameOffset=captionOffset+3+blankHeight+10;
 return {titleHeight,captionOffset,blankHeight,nameOffset,height:nameOffset+(nameLines-1)*11+3};
}
function vouchers(doc:PDFDocument,f:Fonts,s:DocumentSnapshot,revision:number):PDFPage[]{
 const d=s.payload,modern=d.voucher_template==="bm0806",x=10*MM,width=W-20*MM,widths=[.04,.30,.10,.06,.09,.09,.10,.12].map(v=>v*width/(modern?.9:1)),size=8.5;
 const head=mergedHeader(f.bold,size,widths,["Stt","Tên, nhãn hiệu, quy cách vật tư, dụng cụ","Danh điểm","ĐVT","Xin lĩnh","Thực phát","Đơn giá","Thành tiền"],"Số lượng");
 const headHeight=head.height;
 const reason=wrapPdfText("Lý do xuất kho: "+d.reason,f.regular,9,width),warehouse=wrapPdfText("Lĩnh tại kho: "+d.warehouse,f.regular,9,width);
 const unitLines=modern?[...wrapPdfText(d.company,f.bold,9,width),...wrapPdfText(d.department,f.bold,9,width)]:wrapPdfText("Đơn vị: "+d.unit,f.bold,9,width),place=wrapPdfText(modern?"Họ và tên người nhận hàng: "+d.signer_names[2]:`${d.location}, ${day(d.document_at)} · Số: ${d.document_number||"........"}`,f.regular,9,width);
 const headerFields=voucherHeaderFields(d.document_at,d.document_number),voucherDate=modern?headerFields.date:"",voucherNumber=modern?headerFields.number:"";
 const headerSpace=unitLines.length*12+place.length*12+reason.length*12+warehouse.length*12+(modern?42:38);
 const words=wrapPdfText("Cộng thành tiền (viết bằng chữ): "+(d.amount_words||"........................"),f.regular,8.5,width);
 const signatures=modern?["Phòng TCKT","Thủ kho","Người nhận","Lãnh đạo Phòng"]:["Phụ trách cung tiêu","Phòng TCKT","Thủ kho","Người nhận","Người lập"];
 const sigCols=signatures.map((label,i)=>({title:wrapPdfText(label,f.bold,8,width/signatures.length-6),name:wrapPdfText(d.signer_names[i],f.regular,8,width/signatures.length-6)}));
 const signing=voucherSignatureMetrics(Math.max(...sigCols.map(c=>c.title.length)),Math.max(...sigCols.map(c=>c.name.length)));
 const sigHeight=modern?signing.height:Math.max(...sigCols.map(c=>c.title.length))*11+Math.max(...sigCols.map(c=>c.name.length))*11+25;
 // Sum row (23 pt), amount in words, gap, then the complete signing area.
 // All wrapped header/name lines participate in the A5 height budget.
 const footerSpace=modern?23+words.length*11.5+4+sigHeight:words.length*11.5+sigHeight+32;
 const rowBudget=A5-20*MM-headerSpace-headHeight-footerSpace;
 if(rowBudget<(modern?size+3+8:25))throw new Error("Phần đầu/ghi chú quá dài cho A5. Rút gọn nội dung trước khi xuất.");
 const chunks:VoucherChunk[]=[];let chunk:VoucherChunk={rows:[]},remaining=rowBudget;
 d.lines.forEach((line,index)=>{
  const values=[String(index+1),[line.name,line.specification].filter(Boolean).join("\n"),line.catalogue_code,line.unit,number(line.requested),number(line.issued),number(line.unit_price),number(issuedAmount(line))];
  const cells=values.map((t,i)=>({lines:cellLines(t,f.regular,size,widths[i]),align:([0,3,4,5,6,7].includes(i)?"center":"left") as "left"|"center"}));
  const height=Math.max(...cells.map(c=>c.lines.length))*(size+3)+8;
  if(height>rowBudget)throw new Error("Một dòng vật tư quá dài cho A5. Rút gọn tên/quy cách hoặc chia nội dung.");
  if(height>remaining&&chunk.rows.length){chunks.push(chunk);chunk={rows:[]};remaining=rowBudget;}
  chunk.rows.push({line,index,cells,height});remaining-=height;
 });if(chunk.rows.length)chunks.push(chunk);
 return chunks.map((ch,part)=>{
  const page=doc.addPage([W,A5]);let y=A5-10*MM;
  if(d.form_code&&!modern)drawText(page,d.form_code,x+width-f.bold.widthOfTextAtSize(d.form_code,8),A5-15,8,f.bold);
  const paragraph=(lines:string[],font:PDFFont,size=9)=>{lines.forEach(line=>{drawText(page,line,x,y-size,size,font);y-=size+3;});};
  paragraph(unitLines,f.bold);y-=2;centered(page,"PHIẾU LĨNH VẬT TƯ",y-14,14,f.bold,x,width);y-=22;
  if(modern){centered(page,voucherDate,y-9,9,f.regular,x,width*.76);drawText(page,voucherNumber,x+width-f.regular.widthOfTextAtSize(voucherNumber,9),y-9,9,f.regular);y-=15;}
  paragraph(place,f.regular);paragraph(reason,f.regular);paragraph(warehouse,f.regular);y-=3;
  drawMergedHeader(page,x,y,widths,head,size,f.bold);y-=headHeight;
  ch.rows.forEach(r=>{tableRow(page,x,y,widths,r.cells,r.height,size,f.regular);y-=r.height;});
  const total=knownTotal(ch.rows.map(r=>r.line));tableRow(page,x,y,widths,[{lines:[""]},{lines:["Cộng"]},...Array.from({length:5},()=>({lines:[""]})),{lines:[number(total)],align:"center"}],18,size,f.regular);y-=23;
  paragraph(words,f.regular,8.5);y-=4;
  if(modern&&y-signing.height<10*MM-.1)throw new Error("Nội dung vượt khuôn A5; rút gọn phần đầu hoặc dòng vật tư trước khi xuất.");
  const titleHeight=Math.max(...sigCols.map(c=>c.title.length))*11;
  sigCols.forEach((c,i)=>{const col=width/signatures.length; c.title.forEach((line,j)=>drawText(page,line,x+i*col+(col-f.bold.widthOfTextAtSize(line,8))/2,y-8-j*11,8,f.bold));
   centered(page,modern&&i===3?"(Ký, họ tên, đóng dấu)":"(Ký, ghi rõ họ tên)",y-titleHeight-8,7.5,f.regular,x+i*col,col);
   c.name.forEach((line,j)=>drawText(page,line,x+i*col+(col-f.regular.widthOfTextAtSize(line,8))/2,y-(modern?signing.nameOffset:titleHeight+32)-j*11,8,f.regular));
  });
  if(!modern)drawText(page,`${s.source.case_code} · v${revision} · Phần ${part+1}/${chunks.length}`,x,10,7.5,f.regular);
  else if(chunks.length>1)page.drawText(`Phần ${part+1}/${chunks.length}`,{x,y:5*MM,size:6,font:f.regular,color:rgb(.65,.65,.65)});
  return page;
 });
}
export async function renderDocumentPdf(input:DocumentSnapshot,revision:number,createdAt:string):Promise<Uint8Array>{
 const s=snapshotSchema.parse(input);if(!Number.isInteger(revision)||revision<1)throw new Error("Phiên bản không hợp lệ");
 const doc=await PDFDocument.create();metadata(doc,s,createdAt);const f=await fonts(doc);
 const charset=new Set(f.regular.getCharacterSet());
 for(const ch of JSON.stringify(s.payload)){const cp=ch.codePointAt(0);if(cp!==undefined&&!charset.has(cp))throw new Error("Ký tự không được font PDF hỗ trợ; thay ký tự đặc biệt trước khi xuất.");}
 if(s.payload.kind==="condition_minutes")minutes(doc,f,s,revision);
 else{
  vouchers(doc,f,s,revision);const out=await PDFDocument.create();metadata(out,s,createdAt);
  // Finalize and reopen the A5 source before embedding. This preserves every
  // page resource when a voucher continues beyond the first A4 sheet.
  const sourceBytes=await doc.save();
  for(let i=0;i<doc.getPageCount();i++){
   // Load each source page independently so font/resource dictionaries from
   // continuation pages cannot overwrite the preceding embedded page.
   const [p]=await out.embedPdf(sourceBytes,[i]);
   const page=out.addPage([W,H]);page.drawPage(p,{x:0,y:A5,width:W,height:A5});page.drawPage(p,{x:0,y:0,width:W,height:A5});page.drawLine({start:{x:10*MM,y:A5},end:{x:W-10*MM,y:A5},thickness:.35,dashArray:[3,3],color:BLACK});
  }
  return out.save();
 }
 return doc.save();
}
