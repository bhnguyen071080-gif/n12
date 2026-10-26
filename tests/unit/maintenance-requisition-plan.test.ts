import {test} from "node:test";
import assert from "node:assert/strict";
import {buildVoucherPreviews,formatPlannedDay,octoberMaintenancePlan,type PlanGroup,type PlannedMaterial} from "../../src/lib/maintenance-requisition-plan";

const groups:PlanGroup[]=["TUKAN","QC","RTG","KHUNG_CAU"];

test("planned calendar dates retain their day, including month/year boundaries",()=>{
 assert.equal(formatPlannedDay("2026-10-21"),"21/10/2026");
 assert.equal(formatPlannedDay("2027-01-01"),"01/01/2027");
 assert.equal(formatPlannedDay("2028-02-29"),"29/02/2028");
 assert.equal(formatPlannedDay(""),"");
});

test("all group subsets and grouping modes preserve quantities and source separation",()=>{
 const original=structuredClone(octoberMaintenancePlan);
 const totals=(lines:readonly PlannedMaterial[])=>{
  const result:Record<string,number>={};
  for(const line of lines){const key=[line.source,line.key,line.unit,line.catalogueCode??""].join("|");result[key]=(result[key]??0)+line.quantity;}
  return result;
 };
 for(let mask=0;mask<16;mask++){
  const selected=groups.filter((_,index)=>mask&(1<<index));
  const expected=totals(octoberMaintenancePlan.filter(row=>selected.includes(row.group)).flatMap(row=>row.materials));
  for(const grouping of ["equipment","group","date"] as const){
   const previews=buildVoucherPreviews(octoberMaintenancePlan,selected,grouping,"2026-10-21");
   assert.deepEqual(totals(previews.flatMap(v=>v.lines)),expected);
   assert.equal(new Set(previews.map(v=>v.id)).size,previews.length);
   for(const voucher of previews){
    assert.ok(voucher.lines.every(line=>line.source===voucher.source));
    assert.equal(new Set(voucher.equipmentCodes).size,voucher.equipmentCodes.length);
    assert.equal(voucher.equipmentLabels.length,voucher.equipmentCodes.length);
    if(grouping==="equipment")assert.equal(voucher.equipmentCodes.length,1);
   }
  }
 }
 assert.deepEqual(octoberMaintenancePlan,original);
});

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



test("voucher display uses canonical equipment names while retaining shorthand codes internally",()=>{\n const rows=[{sourceLabel:"Khung cẩu No57",equipmentCode:"N57",equipmentName:"No57",group:"KHUNG_CAU" as const,maintenanceLevel:"I - theo tháng" as const,materials:[{key:"grease",name:"Mỡ",unit:"kg",quantity:1,source:"maintenance_consumable" as const}]}];\n const vouchers=buildVoucherPreviews(rows,["KHUNG_CAU"],"equipment","2026-10-21");\n assert.equal(vouchers.length,1);\n assert.deepEqual(vouchers[0].equipmentCodes,["N57"]);\n assert.deepEqual(vouchers[0].equipmentLabels,["No57"]);\n assert.equal(vouchers[0].lines[0].equipmentLabel,"No57");\n});\n