import test from "node:test";
import assert from "node:assert/strict";
import {parseImportGrid,importSpecs,rowCells,type ImportKind} from "../../src/lib/table-import";
import {parseCsv,csvOutput} from "../../src/lib/csv";
const parse=(k:ImportKind,...rows:(string|number|null)[][])=>parseImportGrid([importSpecs[k].headers,...rows],k);
test("material category accepts Vietnamese labels, distinguishes unknown and common, preserves legacy omission",()=>{
 const qc=parse("materials",["M01","Cáp","bộ","Cần trục giàn cầu cảng"]);
 assert.equal(qc.issues.length,0);assert.equal(qc.rows[0].equipment_category,"QC");
 assert.equal(parse("materials",["M01","Cáp","bộ","Dùng chung"]).rows[0].equipment_category,"COMMON");
 assert.equal(parse("materials",["M01","Cáp","bộ",""]).rows[0].equipment_category,null);
 assert.equal(parse("materials",["M01","Cáp","bộ","RTG"]).rows[0].equipment_category,"RTG");
 assert.equal(parse("materials",["M01","Cáp","bộ","Cho thuê"]).issues[0].column,"Loại phương tiện");
 const old=parseImportGrid([importSpecs.materials.headers.slice(0,3),["M01","Cáp","bộ"]],"materials");
 assert.equal(old.issues.length,0);assert.equal(Object.hasOwn(old.rows[0],"equipment_category"),false);
 assert.deepEqual(rowCells(qc.rows[0],"materials"),["M01","Cáp","bộ","Cần trục giàn cầu cảng"]);
});
test("Vietnamese equipment template has no baseline and preserves unknown metadata",()=>{
 const r=parse("equipment",["test_auto","Khung thử","Khung cẩu tự động","Dừng máy","","","OLD1;OLD2",""]);
 assert.equal(r.issues.length,0);assert.equal(r.rows[0].code,"TEST_AUTO");assert.equal(r.rows[0].year,null);assert.equal("initial_hours" in r.rows[0],false);
 assert.equal(rowCells(r.rows[0],"equipment")[2],"Khung cẩu tự động");
});
test("all monthly templates preserve grain, number precision, units and blank versus zero",()=>{
 assert.equal(parse("hours",["TEST","2026-09","0"]).rows[0].operating_hours,0);
 assert.equal(parse("hours",["TEST","2026-09","125,5"]).rows[0].operating_hours,125.5);
 assert.equal(parse("container",["TEST","2026-09",3382]).rows[0].boxes,3382);
 assert.equal(parse("other",["TEST","2026-09-01","BULK",12.125]).rows[0].quantity,12.125);
 for(const [kind,row] of [["hours",["TEST","2026-09",""]],["hours",["TEST","2026-09","1.234"]],["container",["TEST","2026-09","1.5"]],["other",["TEST","2026-09","BULK","1.2345"]]] as [ImportKind,string[]][])assert.equal(parse(kind,row).issues.length,1);
 assert.equal(parse("materials",["MAT","Cáp thử","bộ"]).rows[0].unit,"bộ");assert.equal(parse("cargo",["BULK","Hàng thử","tấn"]).rows[0].unit,"TONNE");
});
test("rows with duplicate keys are never automatically summed and malformed months report exact line",()=>{
 const r=parse("hours",["TEST","2026-09",1],["TEST","2026-09",2],["TEST","2026-09-02",3]);
 assert.deepEqual(r.issues.map(i=>i.line),[3,4]);assert.equal(r.issues[1].column,"Tháng");
 assert.equal(parse("equipment",["TEST","Thử","QC","available","",2020,"SAME;same",""]).issues[0].column,"Mã tham chiếu");
});
test("CSV UTF-8, separator variants, blank templates and 500-row limits",()=>{
 const headers=importSpecs.materials.headers;assert.deepEqual(parseCsv(csvOutput(headers,[]))[0],headers);
 assert.equal(parseImportGrid(parseCsv(headers.join(";")+"\nMAT;Cáp;bộ",";"),"materials").rows.length,1);
 assert.equal(parseImportGrid(parseCsv(headers.join("\t")+"\nMAT\tCáp\tbộ","\t"),"materials").rows.length,1);
 assert.equal(parse("materials").issues.length,1);
 assert.equal(parse("materials",...Array.from({length:501},(_,i)=>["M"+i,"Vật tư","bộ"])).issues.length,1);
});
