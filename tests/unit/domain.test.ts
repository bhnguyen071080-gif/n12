import test from "node:test";
import assert from "node:assert/strict";
import QRCode from "qrcode";
import jsQR from "jsqr";
import {PNG} from "pngjs";
import {actualTimestamp,containerRows,period,quickUrl,safeNext} from "../../src/lib/domain";
import {csvOutput,monthlyCsv,parseCsv} from "../../src/lib/csv";
import {thContainerRows,thHoursRows,hoursIssues} from "../../src/lib/sheets-layout";
test("actual local time is UTC+7; invalid dates are rejected",()=>{
 assert.equal(actualTimestamp("2026-10-09T07:00"),"2026-10-09T00:00:00.000Z");
 assert.throws(()=>actualTimestamp("2026-02-30T08:00"));
});
test("redirects stay inside app routes",()=>{
 for(const value of ["https://evil.example","//evil.example","/\\evil.example","/admin","/\nfoo"])assert.equal(safeNext(value),"/");
 assert.equal(safeNext("/equipment/QC10?action=quick-inspect&workspace=x"),"/equipment/QC10?action=quick-inspect&workspace=x");
});
test("whole-month period guards zero and unbounded intervals",()=>{
 assert.deepEqual(period("2026-01","2026-04"),{from:"2026-01-01",to:"2026-04-01"});
 assert.throws(()=>period("2026-01","2026-01"));assert.throws(()=>period("2020-01","2026-01"));
});
test("independent imports never require data for another module",()=>{
 assert.deepEqual(monthlyCsv("equipment_code,month,operating_hours\nQC10,2026-09,100","hours"),
 [{equipment_code:"QC10",month:"2026-09-01",operating_hours:100}]);
 const row=monthlyCsv("equipment_code,month,boxes\nQC10,2026-09,3382","container")[0];
 assert.deepEqual(row,{equipment_code:"QC10",month:"2026-09-01",boxes:3382});
 assert.equal("teu" in row,false);
 assert.throws(()=>monthlyCsv("equipment_code,month,boxes,teu\nQC10,2026-09,3382,","container"));
 assert.throws(()=>containerRows.parse([{equipment_code:"QC10",month:"2026-09-01",boxes:3382,teu:null}]));
 assert.throws(()=>containerRows.parse([{equipment_code:"QC10",month:"2026-09-01",boxes:1.5}]));
 assert.throws(()=>monthlyCsv("equipment_code,month,operating_hours\nQC10,2026-09,","hours"));
 assert.throws(()=>monthlyCsv("equipment_code,month,operating_hours\nQC10,2026-09,1.234","hours"));
});
test("CSV quotes and spreadsheet formula export are safe",()=>{
 assert.deepEqual(parseCsv('a,b\n"a,b","x""y"'),[["a","b"],["a,b",'x"y']]);
 assert.throws(()=>parseCsv('a\n"unclosed'));
 assert.ok(csvOutput(["x"],[["=HYPERLINK(1)"]]).includes("'=HYPERLINK"));
});
test("TH adapter reads raw integers, carries year, skips seed/totals and preserves zero versus blank",()=>{
 const rows=thContainerRows([
 ["Tên phương tiện","","","QC10","RTG 22"],
 [0.1,"#N/A","#N/A","#N/A","#N/A"],
 ["Số container",2026,"Tháng 1",1234,0],
 ["","","Tháng 2","",5678],
 ["Tổng","","",6912,5678],
 ["","","Tháng 3","",""]
 ]);
 assert.equal(rows.length,3);
 assert.deepEqual(rows[0],{equipment_code:"QC10",month:"2026-01-01",boxes:1234});
 assert.deepEqual(rows[1],{equipment_code:"RTG22",month:"2026-01-01",boxes:0});
 assert.equal(rows[2].month,"2026-02-01");
 assert.throws(()=>thContainerRows([["","","","QC10"],["Số container",2026,"Tháng 1","#N/A"]]));
 assert.throws(()=>thContainerRows([["","","","QC10","QC 10"],["",2026,"Tháng 1",1,2]]));
 containerRows.parse(rows);
});
test("QR round trip decodes the exact workspace-bound HTTPS target",async()=>{
 const target=quickUrl("https://eam.example.com","QC10","00000000-0000-0000-0000-000000000001");
 const bytes=await QRCode.toBuffer(target,{type:"png",margin:4,errorCorrectionLevel:"Q",width:512});
 const png=PNG.sync.read(bytes),decoded=jsQR(new Uint8ClampedArray(png.data),png.width,png.height);
 assert.equal(decoded?.data,target);
 assert.throws(()=>quickUrl("https://user:secret@eam.example.com","QC10","00000000-0000-0000-0000-000000000001"));
 assert.throws(()=>quickUrl("javascript:alert(1)","QC10","00000000-0000-0000-0000-000000000001"));
});

test("TH hours parser has a separate decimal-hours contract and a declared start month",()=>{
 const matrix=[["","","","QC10"],["Giờ",2025,"Tháng 12",12],["Giờ",2026,"Tháng 1",100.25],["","","Tháng 2",0],["TB","","",50],["","","Tháng 3",""]];
 const rows=thHoursRows(matrix,{},"2026-01-01");
 assert.deepEqual(rows,[{equipment_code:"QC10",month:"2026-01-01",operating_hours:100.25},{equipment_code:"QC10",month:"2026-02-01",operating_hours:0}]);
 assert.equal(rows.some(r=>"boxes" in r),false);assert.equal(hoursIssues(rows).length,0);
 assert.equal(hoursIssues([{equipment_code:"QC10",month:"2026-02-01",operating_hours:673}]).length,1);
 assert.throws(()=>thHoursRows([["","","","QC10"],["",2026,"Tháng 1","100,25"]],{},"2026-01-01"));
 assert.throws(()=>thHoursRows([["","","","QC10"],["",2026,"Tháng 1",1.234]],{},"2026-01-01"));
 assert.throws(()=>thHoursRows(matrix,{},""));
});
