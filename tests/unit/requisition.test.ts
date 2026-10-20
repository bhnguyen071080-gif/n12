import {test} from "node:test";
import assert from "node:assert/strict";
import {prepareRequisition} from "../../src/lib/requisition";
import {documentPayloadSchema} from "../../src/lib/documents";
import {sourceEnvelopeSchema} from "../../src/lib/document-source";
import {documentFixture} from "../fixtures/document";
import {renderDocumentPdf,voucherSignatureMetrics} from "../../src/lib/document-pdf";
import {PDFDocument} from "pdf-lib";
const minutes=documentFixture("condition_minutes",2);
const env=sourceEnvelopeSchema.parse({workspace_id:minutes.source.case_id,source_hash:minutes.source_hash,data:{source:minutes.source,summary:"Case summary",items:[],lines:[]}});
const basis={id:"00000000-0000-4000-8000-000000000333",revision:2,snapshot:minutes};
test("new requisition inherits only same-case minutes, with no invented recipient, issue quantity or prices",()=>{
 const before=structuredClone(minutes),d=prepareRequisition(env,undefined,basis).payload;
 assert.equal(d.voucher_template,"bm0806");assert.equal(d.basis_document_id,basis.id);assert.equal(d.company,minutes.payload.company);
 assert.equal(d.lines.length,2);assert.equal(d.lines[0].name,minutes.payload.lines[0].name);assert.equal(d.lines[0].requested,minutes.payload.lines[0].requested);
 assert.ok(d.lines.every(l=>l.usage_id===null&&l.issued===null&&l.unit_price===null&&!l.condition&&!l.limit_text&&!l.used_text));
 assert.ok(d.signer_names.every(s=>!s));assert.equal(d.warehouse,"");assert.notEqual(d.document_at,minutes.payload.document_at);
 assert.equal(documentPayloadSchema.safeParse(d).success,true);assert.deepEqual(minutes,before);
 const wrong={...basis,snapshot:{...minutes,source:{...minutes.source,case_id:"00000000-0000-4000-8000-000000000999"}}};
 assert.equal(prepareRequisition(env,undefined,wrong).payload.basis_document_id,undefined);
 assert.equal(prepareRequisition(env,undefined,wrong).payload.lines.length,0);
 assert.equal(documentPayloadSchema.safeParse({...d,basis_document_id:undefined}).success,false);
});
test("saved voucher edits are never replaced by newer case data or newer minutes",()=>{
 const d=prepareRequisition(env,undefined,basis).payload;d.lines[0].requested=7;d.signer_names[2]="Synthetic recipient";
 const prior={...minutes,payload:d};
 const next=prepareRequisition({...env,source_hash:"b".repeat(64)},prior,{...basis,snapshot:{...minutes,payload:{...minutes.payload,company:"Changed company"}}});
 assert.deepEqual(next.payload,d);assert.equal(next.sourceChanged,true);
});
test("new four-signature voucher remains printable in two identical A5 copies",async()=>{
 const d=prepareRequisition(env,undefined,basis).payload;
 const pdf=await PDFDocument.load(await renderDocumentPdf({...minutes,payload:d},1,"2026-10-20T00:00:00Z"));
 assert.equal(pdf.getPageCount(),1);assert.ok(Math.abs(pdf.getPage(0).getHeight()-841.89)<.01);
});
test("voucher signing has 25 mm clear space and reserves all wrapped name lines",()=>{
 const one=voucherSignatureMetrics(1,1),long=voucherSignatureMetrics(2,3);
 assert.ok(Math.abs(one.blankHeight*25.4/72-25)<.001);
 assert.equal(one.nameOffset-one.captionOffset-13,one.blankHeight);
 assert.equal(long.height-one.height,33);
});
test("A5 automatically moves rows to another two-copy A4 without squeezing signature space",async()=>{
 const counts:number[]=[];
 for(const count of [1,4,5,12]){
  const source=documentFixture("condition_minutes",count);
  source.payload.lines=source.payload.lines.map((l,i)=>({...l,name:`Vật tư ${i+1}`,specification:"",catalogue_code:""}));
  source.payload.company="Công ty thử nghiệm";source.payload.department="Phòng kỹ thuật";
  const payload=prepareRequisition(env,undefined,{...basis,snapshot:source}).payload;
  payload.reason="Sửa chữa";payload.warehouse="Kho thử nghiệm";
  payload.signer_names=["Người thử A","Người thử B","Người thử C","Người thử D",""];
  const pdf=await PDFDocument.load(await renderDocumentPdf({...source,payload},1,"2026-10-20T00:00:00Z"));
  counts.push(pdf.getPageCount());
  for(const page of pdf.getPages()){assert.ok(Math.abs(page.getHeight()-841.89)<.01);assert.ok(Math.abs(page.getWidth()-595.276)<.01);}
 }
 assert.equal(counts[0],1);assert.equal(counts[1],1);assert.ok(counts[2]>1);assert.ok(counts[3]>=counts[2]);
});
