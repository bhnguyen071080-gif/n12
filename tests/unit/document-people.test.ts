import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {renderToStaticMarkup} from "react-dom/server";
import {createElement} from "react";
import {parseRepresentatives,serializeRepresentatives,structuredRepresentatives} from "../../src/lib/document-people";
import {documentPayloadSchema} from "../../src/lib/documents";
import {ConditionMinutesPaper} from "../../src/components/condition-minutes-paper";
import {documentFixture} from "../fixtures/document";
test("legacy participants split literal newlines and align names and titles without losing old text",()=>{
 const people=parseRepresentatives("1. Ông: Người thử A - Phó trưởng phòng Kỹ thuật\\n2. Bà: Người thử B — Nhân viên kỹ thuật");
 assert.deepEqual(people,[{salutation:"Ông",name:"Người thử A",title:"Phó trưởng phòng Kỹ thuật",signs:true},{salutation:"Bà",name:"Người thử B",title:"Nhân viên kỹ thuật",signs:false}]);
 const unstructured=parseRepresentatives("Đại diện chưa phân tách chức danh");assert.equal(unstructured[0].name,"Đại diện chưa phân tách chức danh");assert.equal(unstructured[0].title,"");
});
test("structured representatives round-trip signing choice, including explicitly choosing no signer",()=>{
 const people=parseRepresentatives("1. Ông: Người thử A - Lãnh đạo\n2. Bà: Người thử B - Kỹ thuật").map((person,i)=>({...person,signs:i===1}));
 const stored=serializeRepresentatives(people);assert.equal(structuredRepresentatives(stored),true);assert.deepEqual(parseRepresentatives(stored),people);
 const none=people.map(person=>({...person,signs:false}));assert.deepEqual(parseRepresentatives(serializeRepresentatives(none)),none);
 assert.equal(serializeRepresentatives(parseRepresentatives(stored)),stored);
});
test("new structured fields reject missing names and multiple signing representatives",()=>{
 const s=documentFixture().payload;
 const invalid={unit:"Test",members:serializeRepresentatives([{salutation:"Ông",name:"",title:"Technical role",signs:false}])};
 assert.equal(documentPayloadSchema.safeParse({...s,participants:[invalid]}).success,false);
 const people=parseRepresentatives("A — Role A\nB — Role B").map(person=>({...person,signs:true}));
 assert.equal(documentPayloadSchema.safeParse({...s,participants:[{unit:"Test",members:serializeRepresentatives(people)}]}).success,false);
});
test("print view separates columns, includes selected signers and escapes user-entered markup",()=>{
 const s=documentFixture().payload;s.participants=[{unit:"Test department",members:serializeRepresentatives([{salutation:"Ông",name:"<script>Test</script>",title:"Test title",signs:true}])}];
 const html=renderToStaticMarkup(createElement(ConditionMinutesPaper,{payload:s}));
 assert.ok(html.includes("paper-people"));assert.ok(!html.includes("Họ và tên"));assert.ok(!html.includes("Chức danh"));assert.ok(html.includes("paper-signatures"));assert.ok(html.includes("&lt;script&gt;Test&lt;/script&gt;"));assert.ok(!html.includes("<script>Test</script>"));assert.ok(!html.includes("TV-EAM:DAI-DIEN"));
 const signingSection=html.slice(html.indexOf('class="paper-signatures'));
 assert.ok(signingSection.includes("&lt;script&gt;Test&lt;/script&gt;"));assert.ok(!signingSection.includes("Test title"));
 const withoutSigner=renderToStaticMarkup(createElement(ConditionMinutesPaper,{payload:{...s,participants:[{unit:"Test",members:serializeRepresentatives([{salutation:"Ông",name:"Test name",title:"Test title",signs:false}])}]}}));
 assert.ok(!withoutSigner.slice(withoutSigner.indexOf('class="paper-signatures')).includes("Test name"));
});
test("minutes introduction names the equipment, never the damaged part",()=>{
 const s=documentFixture().payload;s.equipment_label="Synthetic crane";s.inspection_subject="Synthetic damaged bearing";
 const html=renderToStaticMarkup(createElement(ConditionMinutesPaper,{payload:s}));
 assert.ok(html.includes('class="paper-inspection-intro">Cùng nhau kiểm tra, xác định tình trạng kỹ thuật Synthetic crane như sau:'));
 assert.ok(!html.includes("Synthetic damaged bearing"));
});
test("print stylesheet uses the requested Times New Roman 13 and aligned A4 tables",async()=>{
 const css=await readFile(join(process.cwd(),"src/app/globals.css"),"utf8");
 assert.match(css,/TVEAMLocalTimes,"Times New Roman",serif; font-size:13pt/);
 assert.match(css,/@page conditionMinutes \{ size:A4/);assert.match(css,/\.paper-people \{[^}]*table-layout:fixed/);
 assert.match(css,/\.document-page > :not\(\.document-print-area\)/);
 assert.match(css,/@page conditionMinutes \{ size:A4; margin:20mm 10mm/);
 assert.match(css,/\.paper-underlined::after[^}]*border-bottom/);
 assert.match(css,/\.condition-paper \.paper-title h2[^}]*margin:0; line-height:1/);
 assert.match(css,/\.paper-signatures section[^}]*grid-template-rows:subgrid/);
});
