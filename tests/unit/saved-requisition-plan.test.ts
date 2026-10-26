import {test} from "node:test";
import assert from "node:assert/strict";
import {PDFDocument} from "pdf-lib";
import {writeFileSync,mkdirSync} from "node:fs";
import {join} from "node:path";
import {octoberMaintenancePlan} from "../../src/lib/maintenance-requisition-plan";
import {savePlanInputSchema,resolvePlanRows,savedPlanVouchers,planVoucherPayload,type SavedRequisitionPlan} from "../../src/lib/saved-requisition-plan";
import {documentPayloadSchema} from "../../src/lib/documents";
import {renderPlanVoucherPdf} from "../../src/lib/document-pdf";
const id=(n:number)=>`70000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const print={company:"Công ty thử nghiệm",department:"Phòng kỹ thuật",recipient:"Nguyễn Văn A",warehouse:"Kho vật tư",consumableWarehouse:"Kho nhiên liệu",documentDay:"2026-10-22"};
const input=savePlanInputSchema.parse({plannedDay:"2026-10-31",groups:["TUKAN","QC","RTG","KHUNG_CAU"],grouping:"date",mappings:{},print});
const equipment=octoberMaintenancePlan.map((r,i)=>({id:id(i+1),code:r.equipmentCode,name:r.sourceLabel}));
function plan():SavedRequisitionPlan{return {id:id(100),workspace_id:id(101),planned_day:input.plannedDay,grouping_mode:input.grouping,created_by:id(102),created_at:"2026-10-22T00:00:00Z",snapshot:{version:1,rows:resolvePlanRows(input,equipment).map((r,i)=>({...r,caseId:id(200+i),caseCode:`BD-${r.equipmentCode}-TEST`})),print}};}
test("saved plan refuses missing or duplicate equipment, supports explicit catalog mapping",()=>{
 assert.throws(()=>resolvePlanRows(input,[]),/Chưa ghép/);
 assert.throws(()=>resolvePlanRows({...input,mappings:{TUKAN05:equipment[1].id}},equipment),/cùng một/);
 const mapped=resolvePlanRows({...input,mappings:{TUKAN05:equipment[0].id}},[{...equipment[0],code:"TUKAN_05"},...equipment.slice(1)]);
 assert.equal(mapped[0].equipmentCode,"TUKAN_05");assert.equal(mapped[0].sourceLabel,"Tukan 05");
 assert.equal(savePlanInputSchema.safeParse({...input,plannedDay:"2026-10-32"}).success,false);
});
\ntest("saved plan automatically resolves the four frame names to their shorthand catalog codes",()=>{\n const aliases=new Map([["KHUNG57",["N57","No57"]],["KHUNG60",["N60","No60"]],["KHUNG64",["N64","No64"]],["KHUNG66",["N66","No66"]]]),catalog=equipment.map(item=>{\n  const alias=aliases.get(item.code);return alias?{...item,code:alias[0],name:alias[1]}:item;\n });\n const resolved=resolvePlanRows(input,catalog);\n for(const [oldCode,[code,name]] of aliases){const row=resolved.find(item=>item.sourceLabel===`Khung cẩu ${name}`);assert.ok(row,oldCode);assert.equal(row.equipmentCode,code);assert.equal(row.equipmentName,name);}\n});\ntest("plan vouchers preserve allocations and requested quantities without inventing case sources or actual issue",()=>{
 const p=plan(),vouchers=savedPlanVouchers(p);assert.equal(p.snapshot.rows.length,54);assert.equal(vouchers.length,2);
 for(const v of vouchers){const d=planVoucherPayload(p,v);
  assert.ok(d.lines.every(l=>l.issued===null&&l.unit_price===null&&l.usage_id===null));
  assert.equal(d.document_number,"");assert.equal(d.basis_document_id,undefined);
  assert.equal(documentPayloadSchema.safeParse(d).success,false,"case-document rules still require a real basis");
  assert.equal(v.lines.length,p.snapshot.rows.flatMap(row=>row.materials).filter(material=>material.source===v.source).length);
  for(const line of v.lines){const sourceRow=p.snapshot.rows.find(row=>row.equipmentCode===line.equipmentCode),sourceLine=sourceRow?.materials.find(material=>material.key===line.key&&material.source===v.source);assert.ok(sourceLine);assert.equal(line.quantity,sourceLine.quantity);}
 }
 assert.equal(savedPlanVouchers({...p,grouping_mode:"group"}).length,5);
 assert.equal(savedPlanVouchers({...p,grouping_mode:"equipment"}).length,57);
});
test("full 54-equipment plan renders two automatic copies for both BM0806 sources",async()=>{
 const p=plan();for(const v of savedPlanVouchers(p)){
  const bytes=await renderPlanVoucherPdf(planVoucherPayload(p,v),p.id,p.created_at);
  const pdf=await PDFDocument.load(bytes);assert.ok(pdf.getPageCount()>=1);
  if(v.lines.length>4)assert.equal(pdf.getPageCount()%2,0,"full-A4 mode duplicates the complete page sequence");
  for(const page of pdf.getPages()){assert.ok(Math.abs(page.getWidth()-595.276)<1);assert.ok(Math.abs(page.getHeight()-841.89)<1);}
  if(process.env.DOCUMENT_QA_DIR){mkdirSync(process.env.DOCUMENT_QA_DIR,{recursive:true});writeFileSync(join(process.env.DOCUMENT_QA_DIR,`plan-${v.source}.pdf`),bytes);}
 }
});
test("supplemental PDF uses its actual document date and explicit shortfall description",()=>{
 const p=plan();p.snapshot.print={...p.snapshot.print,documentDay:"2026-11-02",voucherKind:"supplemental",supplementNote:"Thiếu thêm khi tháo kiểm tra"};
 p.snapshot.rows=[{...p.snapshot.rows[0],materials:[{key:"extra",name:"Lọc bổ sung",unit:"chiếc",quantity:2,source:"warehouse"}]}];
 const d=planVoucherPayload(p,savedPlanVouchers(p)[0]);assert.equal(d.document_at,"2026-11-02T08:00");assert.match(d.reason,/Thiếu thêm khi tháo kiểm tra/);assert.equal(d.lines.length,1);assert.equal(d.lines[0].requested,2);assert.equal(d.lines[0].issued,null);
});

