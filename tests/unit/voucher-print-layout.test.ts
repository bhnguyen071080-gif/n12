import {test} from "node:test";
import assert from "node:assert/strict";
import {chooseVoucherPrintLayout} from "../../src/lib/voucher-print-layout";

test("short vouchers place two complete A5 copies on one A4 sheet",()=>{
 const layout=chooseVoucherPrintLayout({lineLabels:["Lọc dầu máy","Lọc nhiên liệu"],equipmentLabels:["RTG06","RTG10"]});
 assert.equal(layout.format,"two-up-a5");
 assert.equal(layout.copies,2);
 assert.equal(layout.sheets,1);
 assert.equal(layout.label,"2 liên A5 · 1 tờ A4");
});

test("long vouchers automatically give each copy full A4 pages",()=>{
 const layout=chooseVoucherPrintLayout({lineLabels:Array.from({length:25},(_,index)=>`Vật tư số ${index+1} có tên và quy cách dài để kiểm tra phân trang tự động`),equipmentLabels:Array.from({length:12},(_,index)=>`RTG${index+1}`)});
 assert.equal(layout.format,"full-a4");
 assert.equal(layout.copies,2);
 assert.ok(layout.pagesPerCopy>=2);
 assert.equal(layout.sheets,layout.pagesPerCopy*2);
 assert.equal(layout.chunks.flat().length,25);
});

