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
 assert.equal(warehouse?.lines.length,6);
 assert.deepEqual(warehouse?.lines.map(line=>[line.equipmentCode,line.catalogueCode,line.quantity]),[
  ["RTG06","P554004",1],["RTG06","P554620",2],
  ["RTG10","P554004",1],["RTG10","P554620",2],
  ["RTG12","P554004",1],["RTG12","P554620",2],
 ]);
});

test("group preview keeps one material line per equipment instead of combining quantities",()=>{
 const vouchers=buildVoucherPreviews(octoberMaintenancePlan,groups,"group");
 const tukan=vouchers.find(voucher=>voucher.id==="TUKAN:maintenance_consumable");
 assert.equal(tukan?.lines.length,8);
 assert.deepEqual(tukan?.lines.filter(line=>line.name==="Mỡ EPL2").map(line=>[line.equipmentCode,line.quantity]),[
  ["TUKAN05",15],["TUKAN06",15],["TUKAN07",15],["TUKAN10",15],["TUKAN11",15],["TUKAN12",15],
 ]);
 const total=(id:string,name:string)=>(vouchers.find(voucher=>voucher.id===id)?.lines??[]).filter(line=>line.name===name).reduce((sum,line)=>sum+line.quantity,0);
 assert.equal(total("QC:maintenance_consumable","Mỡ EPL2"),140);
 assert.equal(total("RTG:maintenance_consumable","Dầu máy"),105);
 assert.equal(total("KHUNG_CAU:maintenance_consumable","Mỡ V220-0"),21);
});

test("individual preview creates a separate voucher only when an equipment has that source",()=>{
 const vouchers=buildVoucherPreviews(octoberMaintenancePlan,groups,"equipment");
 assert.equal(vouchers.length,57);
 assert.equal(vouchers.filter(voucher=>voucher.source==="warehouse").length,3);
 assert.equal(vouchers.filter(voucher=>voucher.source==="maintenance_consumable").length,54);
});

test("same-day preview combines all selected equipment but keeps sources separate",()=>{
 const vouchers=buildVoucherPreviews(octoberMaintenancePlan,groups,"date","2026-10-21");
 assert.equal(vouchers.length,2);
 assert.equal(vouchers.filter(voucher=>voucher.source==="warehouse").length,1);
 assert.equal(vouchers.filter(voucher=>voucher.source==="maintenance_consumable").length,1);
 assert.equal(vouchers.every(voucher=>voucher.scopeLabel==="Ngày 21/10/2026"),true);
 assert.equal(vouchers.find(voucher=>voucher.source==="maintenance_consumable")?.equipmentCodes.length,54);
 assert.equal(vouchers.find(voucher=>voucher.source==="maintenance_consumable")?.lines.length,77);
});

