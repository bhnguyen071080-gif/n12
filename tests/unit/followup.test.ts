import test from "node:test";
import assert from "node:assert/strict";
import {actualDay,defaultEndMonth,inclusiveRange,monthLabel,previousMonth,summarizeHours} from "../../src/lib/monthly-hours";
import {itemPayload} from "../../src/lib/followup";
import {safeNext} from "../../src/lib/domain";
test("inclusive hour periods support one month and year transitions",()=>{
 assert.deepEqual(inclusiveRange("2026-09","2026-09"),{from:"2026-09-01",to:"2026-09-01"});
 assert.deepEqual(inclusiveRange("2025-12","2026-02"),{from:"2025-12-01",to:"2026-02-01"});
 assert.throws(()=>inclusiveRange("2026-10","2026-09"));assert.throws(()=>inclusiveRange("2026-13","2026-09"));assert.throws(()=>inclusiveRange("2000-01","2050-01"));
});
test("manual end defaults by current-month data of selected machine",()=>{
 const now=new Date("2026-10-12T00:00:00Z");
 assert.equal(defaultEndMonth(true,now),"2026-10");assert.equal(defaultEndMonth(false,now),"2026-09");assert.equal(previousMonth("2026-01"),"2025-12");
 assert.equal(defaultEndMonth(false,new Date("2025-12-31T18:00:00Z")),"2025-12");
});
test("missing and zero remain distinct in month totals",()=>{
 assert.deepEqual(summarizeHours([{month:"2026-01-01",operating_hours:100},{month:"2026-02-01",operating_hours:0},{month:"2026-03-01",operating_hours:null}]),{total:100,missing:["2026-03"]});
 assert.deepEqual(summarizeHours([{month:"2026-02-01",operating_hours:0}]),{total:0,missing:[]});
 assert.deepEqual(summarizeHours([{month:"2026-03-01",operating_hours:null}]),{total:null,missing:["2026-03"]});assert.equal(monthLabel("2026-10-01"),"10/2026");
});
test("work day is a real date independent of entry code time",()=>{
 assert.equal(actualDay("2024-02-29"),"2024-02-29");for(const s of ["2026-02-29","2026-02-30","2026-13-01","1999-12-31"])assert.throws(()=>actualDay(s));
 assert.equal(safeNext("/cases/00000000-0000-0000-0000-000000000001"),"/cases/00000000-0000-0000-0000-000000000001");
});
test("technical item retains four contents and six independent progress fields",()=>{
 const item={symptom:"A",root_cause:"B",solution_plan:"C",execution_result:"D",performed_on:"2026-01-10",basis_status:"incident_code_assigned",material_status:"borrowed",
 requisition_status:"temporary_issue_debt",execution_status:"completed",acceptance_status:"pending",dossier_status:"collecting"};
 assert.deepEqual(itemPayload.parse(item),item);assert.throws(()=>itemPayload.parse({...item,status:"repairing"}));
});
