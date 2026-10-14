import {unzipSync,strFromU8} from "fflate";
import {importSpecs,type ImportKind} from "./table-import";
export function extractImportXml(bytes:Uint8Array):Record<string,string>{
 if(bytes.length>1048576)throw Error("Tệp Excel tối đa 1 MiB.");
 let count=0,total=0;const names=new Set<string>();
 const files=unzipSync(bytes,{filter:f=>{
  if(++count>200 || names.has(f.name))throw Error("Cấu trúc tệp Excel không hợp lệ.");names.add(f.name);
  if(/vbaProject|externalLinks|connections\.xml/.test(f.name))throw Error("Không nhập tệp có mã chạy hoặc kết nối ngoài; hãy lưu một bản dữ liệu thuần.");
  const keep=/^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(f.name);
  if(keep){total+=f.originalSize;if(f.originalSize>4000000||total>8000000)throw Error("Nội dung giải nén vượt giới hạn; hãy tách tệp.");}return keep;
 }});
 return Object.fromEntries(Object.entries(files).map(([k,v])=>[k,strFromU8(v)]));
}
// Self-contained browser XML parser, also exercised in a real DOM by CI.
export function parseImportXml(files:Record<string,string>,sheetName:string):(string|number|null)[][]{
 const xml=(s:string|undefined)=>{if(!s||/<!DOCTYPE|<!ENTITY/i.test(s))throw Error("Nội dung Excel không hợp lệ.");const doc=new DOMParser().parseFromString(s,"application/xml");if(doc.getElementsByTagName("parsererror").length)throw Error("Không đọc được cấu trúc Excel.");return doc;};
 const elements=(p:Document|Element,name:string)=>Array.from(p.getElementsByTagNameNS("*",name));
 const workbook=xml(files["xl/workbook.xml"]),sheets=elements(workbook,"sheet");
 const sheet=sheets.find(e=>e.getAttribute("name")===sheetName);
 if(!sheet||sheet.getAttribute("state")==="hidden"||sheet.getAttribute("state")==="veryHidden")throw Error("Không tìm thấy trang dữ liệu “"+sheetName+"” đang hiển thị. Dùng mẫu tải từ ứng dụng.");
 const id=sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","id")??sheet.getAttribute("r:id");
 const rel=elements(xml(files["xl/_rels/workbook.xml.rels"]),"Relationship").find(e=>e.getAttribute("Id")===id);
 if(!rel||rel.getAttribute("TargetMode")==="External")throw Error("Liên kết trang Excel không hợp lệ.");
 const target=rel.getAttribute("Target")??"",path=target.startsWith("/")?target.slice(1):"xl/"+target;
 if(!/^xl\/worksheets\/[^/]+\.xml$/.test(path))throw Error("Đường dẫn trang dữ liệu không được hỗ trợ.");
 const strings=files["xl/sharedStrings.xml"]?elements(xml(files["xl/sharedStrings.xml"]),"si").map(si=>elements(si,"t").map(t=>t.textContent??"").join("")):[];
 const rows=elements(xml(files[path]),"row"),grid:(string|number|null)[][]=[];
 for(const row of rows){const ri=Number(row.getAttribute("r"));if(!Number.isInteger(ri)||ri<1||ri>2000)throw Error("Trang dữ liệu chỉ được có tối đa 2000 dòng đánh số; nhập tối đa 500 dòng có nội dung mỗi lần.");const cells:(string|number|null)[]=[];
  for(const c of elements(row,"c")){
   const ref=c.getAttribute("r")??"",m=/^([A-Z]{1,2})(\d+)$/.exec(ref);if(!m||Number(m[2])!==ri)throw Error("Địa chỉ ô Excel không hợp lệ.");
   const ci=Array.from(m[1]).reduce((n,l)=>n*26+l.charCodeAt(0)-64,0)-1;if(ci>31)throw Error("Dữ liệu nằm ngoài cột của mẫu.");
   if(elements(c,"f").length)throw Error("Ô "+ref+" có công thức. Sao chép rồi dán giá trị trước khi nhập; không dùng kết quả lưu đệm.");
   const type=c.getAttribute("t"),v=elements(c,"v")[0]?.textContent??"";let value:string|number|null=null;
   if(type==="s"){const n=Number(v);if(!/^\d+$/.test(v)||strings[n]===undefined)throw Error("Chuỗi Excel không hợp lệ.");value=strings[n];}
   else if(type==="inlineStr")value=elements(c,"t").map(t=>t.textContent??"").join("");
   else if(type==="str"||type==="d")value=v;
   else if(type==="e"||type==="b")throw Error("Ô "+ref+" có lỗi hoặc giá trị đúng/sai không phù hợp.");
   else if(v!==""){value=Number(v);if(!Number.isFinite(value))throw Error("Số Excel không hợp lệ.");}
   if(cells[ci]!==undefined)throw Error("Lặp địa chỉ ô.");cells[ci]=value;
  }
  if(grid[ri-1])throw Error("Lặp số dòng Excel.");grid[ri-1]=Array.from({length:cells.length},(_,i)=>cells[i]??null);
 }
 const result=Array.from({length:grid.length},(_,i)=>grid[i]??[]),monthCol=(result[0]??[]).findIndex(v=>v==="Tháng");
 const date1904=elements(workbook,"workbookPr")[0]?.getAttribute("date1904");
 if(monthCol>=0)for(let i=1;i<result.length;i++){const v=result[i][monthCol];if(typeof v==="number"){if(!Number.isInteger(v))throw Error("Tháng phải là ngày đầu tháng, không kèm giờ.");const date=new Date((date1904==="1"||date1904==="true"?Date.UTC(1904,0,1):Date.UTC(1899,11,30))+v*86400000);result[i][monthCol]=date.toISOString().slice(0,10);}}
 return result;
}
export function readImportXlsx(bytes:Uint8Array,kind:ImportKind){return parseImportXml(extractImportXml(bytes),importSpecs[kind].sheet);}
