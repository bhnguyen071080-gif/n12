import test from "node:test";
import assert from "node:assert/strict";
import {createEquipmentIdentityMatcher,filterEquipment,equipmentCounts,equipmentLabel,type EquipmentCard} from "../../src/lib/equipment-display";
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
test("equipment label puts the name first and keeps code only as a shorthand",()=>{
 assert.equal(equipmentLabel(rows[0]),"Cần trục chân đế (mã TEST_A)");
 assert.equal(equipmentLabel({code:"QC05",name:"QC05"}),"QC05");
});
test("equipment identity accepts either full name or shorthand without guessing collisions",()=>{
 const frames=[57,60,64,66].map((number,index)=>({id:`frame-${index}`,code:`N${number}`,name:`No${number}`}));
 const match=createEquipmentIdentityMatcher(frames);
 for(const frame of frames){assert.equal(match(`KHUNG${frame.code.slice(1)}`,`Khung cẩu ${frame.name}`)?.id,frame.id);assert.equal(match(frame.code)?.name,frame.name);}
 const ambiguous=createEquipmentIdentityMatcher([{id:"a",code:"A57",name:"No57"},{id:"b",code:"N57",name:"Khung cẩu số 57"}]);
 assert.equal(ambiguous("Khung cẩu No57","N57"),undefined);
});

