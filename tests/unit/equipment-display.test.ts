import test from "node:test";
import assert from "node:assert/strict";
import {filterEquipment,equipmentCounts,type EquipmentCard} from "../../src/lib/equipment-display";
const rows:EquipmentCard[]=[
 {id:"a",workspace_id:"test",code:"TEST_A",name:"Cần trục chân đế",status:"available"},
 {id:"b",workspace_id:"test",code:"TEST_B",name:"Khung cẩu tự động",status:"maintenance"},
 {id:"c",workspace_id:"test",code:"TEST_C",name:"Cần trục bãi",status:"in_repair"},
 {id:"d",workspace_id:"test",code:"TEST_D",name:"Thiết bị dừng",status:"stopped_waiting_material"},
];
test("equipment search is accent insensitive and combines status without changing records",()=>{
 assert.deepEqual(filterEquipment(rows,"  CAN TRUC chan de  ","").map(e=>e.id),["a"]);
 assert.deepEqual(filterEquipment(rows,"tu dong","maintenance").map(e=>e.id),["b"]);
 assert.deepEqual(filterEquipment(rows,"test_", "in_repair").map(e=>e.id),["c"]);
 assert.equal(filterEquipment(rows,"khong co","").length,0);
 assert.equal(filterEquipment(rows,"can truc","maintenance").length,0);
 assert.equal(rows.length,4);
});
test("dashboard counts only recorded statuses and keeps an empty catalog honest",()=>{
 assert.deepEqual(equipmentCounts(rows),{total:4,available:1,repair:2});
 assert.deepEqual(equipmentCounts([]),{total:0,available:0,repair:0});
});
