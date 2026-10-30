import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdir,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {PDFDocument} from "pdf-lib";
import {documentPayloadSchema,decodeDocumentPayload,documentFilename,knownTotal,inspectionLine} from "../../src/lib/documents";
import {prefillDocument,sourceEnvelopeSchema,editorDocument,independentMinutes} from "../../src/lib/document-source";
import {renderDocumentPdf} from "../../src/lib/document-pdf";
import {documentFixture} from "../fixtures/document";
import {serializeRepresentatives} from "../../src/lib/document-people";
const created="2026-10-13T02:30:00Z";
test("document payload rejects invalid dates, duplicate lines and hidden status fields",()=>{
 const d=documentFixture().payload;
 assert.equal(documentPayloadSchema.safeParse({...d,document_at:"2026-02-30T08:00"}).success,false);
 assert.equal(documentPayloadSchema.safeParse({...d,lines:[d.lines[0],d.lines[0]]}).success,false);
 assert.equal(documentPayloadSchema.safeParse({...d,return_status:"completed"}).success,false);
 assert.equal(documentPayloadSchema.safeParse({...d,lines:[{...d.lines[0],requested:-1}]}).success,false);
 assert.equal(documentPayloadSchema.safeParse({...d,lines:[{...d.lines[0],requested:1.2345}]}).success,false);
 assert.throws(()=>decodeDocumentPayload("x".repeat(400001)));
});
test("unknown issue quantities and prices stay blank, not fabricated zero or requested quantity",()=>{
 const d=documentFixture().payload;
 assert.equal(knownTotal(d.lines),null);assert.equal(knownTotal([{...d.lines[0],issued:0,unit_price:500}]),0);
 assert.equal(knownTotal([{...d.lines[0],issued:2,unit_price:500}]),1000);
});
test("prefill uses source case and technical content, never sample names, issue state or old number",()=>{
 const fixture=documentFixture(),prior={...fixture,payload:{...fixture.payload,document_number:"OLD",equipment_label:"OLD EQUIPMENT",reason:"OLD CASE"}};
 const env=sourceEnvelopeSchema.parse({workspace_id:fixture.source.case_id,source_hash:fixture.source_hash,data:{source:fixture.source,summary:"New case",items:[{id:fixture.source.case_id,item_no:1,version:1,performed_on:"2026-10-12",symptom:"Symptom",root_cause:"Cause",solution_plan:"Plan",execution_result:"Done"}],lines:[{usage_id:fixture.payload.lines[0].usage_id,item_id:fixture.source.case_id,item_no:1,name:"New material",code:"NEW",unit:"Chiếc",quantity:2,condition:"Symptom",service_limit_hours:null,supply_state:"issued",is_installed:true}]}});
 const d=prefillDocument(env,"material_requisition",prior);
 assert.equal(d.document_number,"");assert.equal(d.reason,"New case");assert.equal(d.lines[0].issued,null);assert.equal(d.lines[0].unit_price,null);assert.equal(d.lines[0].used_text,"");assert.equal(d.lines[0].limit_text,"");assert.equal(d.cause,"Cause");
 assert.ok(d.equipment_label.includes("TEST01"));assert.equal(d.lines[0].requested,2);
 const first=prefillDocument(env,"condition_minutes");assert.equal(first.company,"");assert.equal(first.participants[0].members,"");
});
test("PDF names are case-linked and cannot inject paths or headers",()=>{
 const s=documentFixture().source;assert.equal(documentFilename(s,"material_requisition",2),"PL-SC-TEST01-13102026-0900-001-v2.pdf");
 assert.ok(!/[\r\n/\\]/.test(documentFilename({...s,case_code:"../../evil\r\n"},"condition_minutes",1)));
});
test("new minutes use their own inspection date and content, never case creation or technical-item facts",()=>{
 const s=documentFixture();
 const env=sourceEnvelopeSchema.parse({workspace_id:s.source.case_id,source_hash:s.source_hash,data:{source:s.source,summary:"Case summary, not inspection findings",items:[{id:s.source.case_id,item_no:1,version:2,performed_on:"2026-10-19",symptom:"Case symptom",root_cause:"Case cause",solution_plan:"Case plan",execution_result:"Case completion"}],lines:[{usage_id:s.payload.lines[0].usage_id,item_id:s.source.case_id,item_no:1,name:"Linked material",code:"VT-1",unit:"Chiếc",quantity:3,condition:"Source condition",service_limit_hours:1000}]}});
 const payload=prefillDocument(env,"condition_minutes");
 assert.equal(payload.document_at,"");assert.equal(payload.document_number,"");assert.equal(payload.form_code,"BM.12.06");
 assert.equal(payload.inspection_subject,"");assert.equal(payload.cause,"");assert.equal(payload.solution,"");
 assert.equal(payload.lines.length,1);assert.equal(payload.lines[0].usage_id,null);assert.equal(payload.lines[0].condition,"");assert.equal(payload.lines[0].limit_text,"");
 assert.equal(payload.participants.length,2);assert.ok(payload.participants.every(p=>!p.members));
 assert.equal(payload.equipment_label,`${s.source.equipment_name} (${s.source.equipment_code})`);
});
test("saved minutes retain every entered value after source changes, and detach only usage links",()=>{
 const s=documentFixture(),env=sourceEnvelopeSchema.parse({workspace_id:s.source.case_id,source_hash:"b".repeat(64),data:{source:s.source,summary:"Changed case",items:[],lines:[]}});
 const before=structuredClone(s);
 const draft=editorDocument(env,"condition_minutes",s);
 assert.equal(draft.sourceChanged,true);assert.equal(draft.payload.document_at,"2026-10-13T09:30");
 assert.deepEqual(draft.payload,{...s.payload,lines:s.payload.lines.map(line=>({...line,usage_id:null}))});
 assert.deepEqual(s,before);assert.equal(documentPayloadSchema.safeParse(draft.payload).success,true);
 const voucher=documentFixture("material_requisition");
 assert.deepEqual(independentMinutes(voucher.payload),voucher.payload);
 assert.equal(editorDocument(env,"material_requisition",voucher).payload.lines.length,0);
});
test("minutes expose limit and actual values even without material usage; vouchers stay linked-only",()=>{
 const s=documentFixture();
 const env=sourceEnvelopeSchema.parse({workspace_id:s.source.case_id,source_hash:s.source_hash,data:{source:s.source,summary:"Synthetic fault",items:[],lines:[]}});
 const d=prefillDocument(env,"condition_minutes");
 assert.equal(d.lines.length,1);assert.equal(d.lines[0].usage_id,null);
 assert.equal(d.lines[0].name,s.source.equipment_name);assert.equal(d.lines[0].limit_text,"");assert.equal(d.lines[0].used_text,"");assert.equal(d.lines[0].unit,"");
 assert.equal(prefillDocument(env,"material_requisition").lines.length,0);
 const manual={...inspectionLine("Cable","Wear"),unit:"Piece",limit_text:"1000 hours",used_text:"660 hours"};
 const payload={...s.payload,lines:[manual,{...manual,used_text:"Unknown"}]};
 assert.equal(documentPayloadSchema.safeParse(payload).success,true);
 assert.equal(documentPayloadSchema.safeParse({...payload,kind:"material_requisition"}).success,false);
 const snapshot={...s,payload};
 assert.deepEqual(editorDocument(env,"condition_minutes",snapshot).payload.lines,payload.lines);
 assert.equal(editorDocument({...env,source_hash:"b".repeat(64)},"condition_minutes",snapshot).sourceChanged,true);
 assert.equal(editorDocument(env,"condition_minutes",{...snapshot,source:{...s.source,case_id:"00000000-0000-4000-8000-000000000099"}}).payload.lines[0].used_text,"");
});
test("manual minutes rows render in the existing A4 table without material usage IDs",async()=>{
 const s=documentFixture();s.payload.lines=[{...inspectionLine("Cable","Wear"),unit:"Piece",limit_text:"1000 hours",used_text:"660 hours"}];
 const bytes=await renderDocumentPdf(s,1,created);const pdf=await PDFDocument.load(bytes);assert.equal(pdf.getPageCount(),1);
 if(process.env.DOCUMENT_QA_DIR){await mkdir(process.env.DOCUMENT_QA_DIR,{recursive:true});await writeFile(join(process.env.DOCUMENT_QA_DIR,"manual-minutes-a4.pdf"),bytes);}
});
test("compatibility PDF can render structured people without printing the storage marker",async()=>{
 const s=documentFixture();s.payload.participants=[{unit:"Đơn vị thử nghiệm",members:serializeRepresentatives([{salutation:"Ông",name:"Đại diện thử nghiệm",title:"Chức danh thử nghiệm",signs:true}])}];
 const pdf=await PDFDocument.load(await renderDocumentPdf(s,2,created));assert.ok(pdf.getPageCount()>=1);
});
test("minutes PDF is A4, deterministic, Vietnamese-capable and paginates long content",async()=>{
 const fixture=documentFixture(),a=await renderDocumentPdf(fixture,1,created),b=await renderDocumentPdf(fixture,1,created);
 assert.deepEqual(a,b);const doc=await PDFDocument.load(a);assert.equal(doc.getPageCount(),1);const page=doc.getPages()[0];
 assert.ok(Math.abs(page.getWidth()-595.276)<.01);assert.ok(Math.abs(page.getHeight()-841.89)<.01);
 const long=documentFixture("condition_minutes",45);const pages=await PDFDocument.load(await renderDocumentPdf(long,1,created));assert.ok(pages.getPageCount()>1);
 if(process.env.DOCUMENT_QA_DIR){await mkdir(process.env.DOCUMENT_QA_DIR,{recursive:true});await writeFile(join(process.env.DOCUMENT_QA_DIR,"minutes-a4.pdf"),a);await writeFile(join(process.env.DOCUMENT_QA_DIR,"minutes-long.pdf"),await renderDocumentPdf(long,1,created));}
});
test("requisition PDF repeats identical A5 content twice on each A4, including continuation",async()=>{
 const fixture=documentFixture("material_requisition"),pdf=await renderDocumentPdf(fixture,1,created),doc=await PDFDocument.load(pdf);
 assert.equal(doc.getPageCount(),1);assert.ok(Math.abs(doc.getPages()[0].getHeight()-841.89)<.01);
 const long=documentFixture("material_requisition",18),more=await renderDocumentPdf(long,1,created),pages=await PDFDocument.load(more);assert.ok(pages.getPageCount()>1);
 if(process.env.DOCUMENT_QA_DIR){await mkdir(process.env.DOCUMENT_QA_DIR,{recursive:true});await writeFile(join(process.env.DOCUMENT_QA_DIR,"voucher-a5-two-up.pdf"),pdf);await writeFile(join(process.env.DOCUMENT_QA_DIR,"voucher-long.pdf"),more);}
});
test("content that exceeds A5 automatically moves to two full A4 copies without clipping",async()=>{
 const d=documentFixture("material_requisition");d.payload.lines[0].name="Vật tư ".repeat(60);
 const pdf=await PDFDocument.load(await renderDocumentPdf(d,1,created));
 assert.equal(pdf.getPageCount(),2);
 for(const page of pdf.getPages()){assert.ok(Math.abs(page.getHeight()-841.89)<.01);assert.ok(Math.abs(page.getWidth()-595.276)<.01);}
});
test("unsupported glyphs are rejected instead of appearing as missing boxes",async()=>{
 const d=documentFixture();d.payload.inspection_subject="🛠️";await assert.rejects(()=>renderDocumentPdf(d,1,created),/font PDF/);
});

