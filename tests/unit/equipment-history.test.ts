import test from "node:test";
import assert from "node:assert/strict";
import {equipmentHistoryTitle,groupEquipmentHistory} from "../../src/lib/equipment-history";

test("vehicle name is primary and a distinct code remains a secondary reference",()=>{
 assert.equal(equipmentHistoryTitle({code:"RTG06",name:"Cẩu RTG số 06"}),"SỬA CHỮA, THAY THẾ, CẢI TẠO CÁC BỘ PHẬN CƠ CẤU CỦA MÁY TRỤC CẨU RTG SỐ 06 (MÃ RTG06)");
 assert.equal(equipmentHistoryTitle({code:"RTG06",name:"RTG06"}),"SỬA CHỮA, THAY THẾ, CẢI TẠO CÁC BỘ PHẬN CƠ CẤU CỦA MÁY TRỤC RTG06");
});

test("all-equipment output becomes one history sheet per vehicle",()=>{
 const a={id:"a",code:"RTG06",name:"RTG06"},b={id:"b",code:"QC05",name:"QC05"};
 const groups=groupEquipmentHistory([
  {key:"2",equipment:a,day:"2022-01-10",content:"Thay AVR"},
  {key:"1",equipment:b,day:"2022-01-09",content:"Bảo dưỡng điện"},
 ],[b,a]);
 assert.deepEqual(groups.map(group=>[group.equipment.code,group.rows.length]),[["QC05",1],["RTG06",1]]);
});

