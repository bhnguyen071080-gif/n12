import test from "node:test";
import assert from "node:assert/strict";
import {parseBaselineForm} from "../../src/lib/operating-baseline";
import {equipmentSchema} from "../../src/lib/domain";
function data(changes:Record<string,string>={}){
 const d=new FormData();for(const [k,v] of Object.entries({equipment:"70000000-0000-0000-0000-000000000001",request_key:"70000000-0000-0000-0000-000000000002",initial_hours:"125.50",start_month:"2026-09",baseline_confirmed:"on",...changes}))d.set(k,v);return d;
}
test("baseline belongs to hours monitoring with an explicit first month",()=>{
 const r=parseBaselineForm(data());assert.equal(r.hours,125.5);assert.equal(r.start,"2026-09-01");assert.equal(r.confirmed,true);
 assert.equal(parseBaselineForm(data({initial_hours:"0"})).hours,0);
});
test("blank, malformed, excessive or unconfirmed baseline is not a zero",()=>{
 for(const value of ["","-1","1.234","1e3","NaN","1000000001"])assert.throws(()=>parseBaselineForm(data({initial_hours:value})));
 for(const value of ["","2026-13","1999-12","2200-01","2026-09-01"])assert.throws(()=>parseBaselineForm(data({start_month:value})));
 assert.throws(()=>parseBaselineForm(data({baseline_confirmed:""})));
});
test("equipment can be cataloged before its meter is known",()=>{
 const r=equipmentSchema.parse({id:"70000000-0000-0000-0000-000000000001",workspace_id:"00000000-0000-0000-0000-000000000001",code:"TEST",name:"Thử",category:"QC",status:"available",initial_hours:null,accumulated_hours:null,team_id:null,hours_start_month:null});
 assert.equal(r.initial_hours,null);assert.equal(r.accumulated_hours,null);
});
