import test from "node:test";
import assert from "node:assert/strict";
import {replacementStats,type MaterialReplacement} from "../../src/lib/material-replacements";

const base={equipment_name:"Tukan 05",material_name:"Vòng bi",unit:"vòng",quantity:1,position:"Cơ cấu nâng",case_id:null,case_code:null,order_code:"SC-01",total_count:3};
const rows:MaterialReplacement[]=[
 {...base,equipment_id:"10000000-0000-0000-0000-000000000001",equipment_code:"TUKAN05",material_id:"20000000-0000-0000-0000-000000000001",material_code:"VT-01",usage_id:"30000000-0000-0000-0000-000000000001",item_id:"40000000-0000-0000-0000-000000000001",replaced_on:"2026-10-01",previous_replaced_on:"2026-07-01",days_since_previous:92},
 {...base,equipment_id:"10000000-0000-0000-0000-000000000001",equipment_code:"TUKAN05",material_id:"20000000-0000-0000-0000-000000000002",material_code:"VT-02",usage_id:"30000000-0000-0000-0000-000000000002",item_id:"40000000-0000-0000-0000-000000000002",replaced_on:"2026-09-01",previous_replaced_on:null,days_since_previous:null},
 {...base,equipment_id:"10000000-0000-0000-0000-000000000002",equipment_code:"TUKAN06",material_id:"20000000-0000-0000-0000-000000000001",material_code:"VT-01",usage_id:"30000000-0000-0000-0000-000000000003",item_id:"40000000-0000-0000-0000-000000000003",replaced_on:"2026-08-01",previous_replaced_on:"2026-05-01",days_since_previous:92}
];

test("replacement summary counts events, vehicles, materials and repeat intervals",()=>{
 assert.deepEqual(replacementStats(rows),{total:3,equipment:2,materials:2,repeated:2,averageDays:92});
});

test("replacement summary handles an empty result",()=>{
 assert.deepEqual(replacementStats([]),{total:0,equipment:0,materials:0,repeated:0,averageDays:null});
});

