import {test} from "node:test";
import assert from "node:assert/strict";
import {buildVoucherPreviews,octoberMaintenancePlan,type PlanGroup} from "../../src/lib/maintenance-requisition-plan";

const groups:PlanGroup[]=["TUKAN","QC","RTG","KHUNG_CAU"];

test("October plan contains the four requested groups and excludes rags",()=>{
 assert.equal(octoberMaintenancePlan.length,54);
 assert.deepEqual(Object.fromEntries(groups.map(group=>[group,octoberMaintenancePlan.filter(row=>row.group===group).length])),{TUKAN:6,QC:7,RTG:26,KHUNG_CAU:15});
 assert.equal(octoberMaintenancePlan.flatMap(row=>row.materials).some(item=>/giẻ/i.test(item.name)||item.key.includes("rag")),false);
});

test("group preview separates warehouse items from maintenance consumables",()=>{
 const vouchers=buildVoucherPreviews(octoberMaintenancePlan,groups,"group");
 assert.equal(vouchers.length,5);
 assert.equal(vouchers.filter(voucher=>voucher.source==="warehouse").length,1);
 assert.equal(vouchers.filter(voucher=>voucher.source==="maintenance_consumable").length,4);
 const warehouse=vouchers.find(voucher=>voucher.id==="RTG:warehouse");
 assert.deepEqual(warehouse?.lines.map(line=>[line.catalogueCode,line.quantity]),[["P554004",3],["P554620",6]]);
});

test("plan totals match the selected monthly source table after rag removal",()=>{
 const vouchers=buildVoucherPreviews(octoberMaintenancePlan,groups,"group");
 const totals=(id:string)=>Object.fromEntries((vouchers.find(voucher=>voucher.id===id)?.lines??[]).map(line=>[line.name,line.quantity]));
 assert.deepEqual(totals("TUKAN:maintenance_consumable"),{"Mỡ EPL2":90,"Dầu thủy lực":60,"Dầu hộp số":380});
 assert.deepEqual(totals("QC:maintenance_consumable"),{"Dầu thủy lực":30,"Mỡ EPL2":140,"Mỡ V220-0":15});
 assert.deepEqual(totals("RTG:maintenance_consumable"),{"Mỡ EPL2":260,"Dầu máy":105,"Xăng":9,"Dầu diesel":9,"Dầu hộp số":340});
 assert.deepEqual(totals("KHUNG_CAU:maintenance_consumable"),{"Mỡ EPL2":7,"Mỡ V220-0":21,"Dầu thủy lực":80});
});

test("individual preview creates a separate voucher only when an equipment has that source",()=>{
 const vouchers=buildVoucherPreviews(octoberMaintenancePlan,groups,"equipment");
 assert.equal(vouchers.length,57);
 assert.equal(vouchers.filter(voucher=>voucher.source==="warehouse").length,3);
 assert.equal(vouchers.filter(voucher=>voucher.source==="maintenance_consumable").length,54);
});

