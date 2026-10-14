import test from "node:test";
import assert from "node:assert/strict";
import {parseCatalogForm} from "../../src/lib/equipment-catalog";
import {safeNext} from "../../src/lib/domain";
function data(changes:Record<string,string>={}){
 const d=new FormData();for(const [k,v] of Object.entries({workspace:"00000000-0000-0000-0000-000000000001",request_key:"70000000-0000-0000-0000-000000000001",code:" test_auto ",name:" Khung thử ",category:"SPREADER_AUTO",base_status:"stopped",serial:"",year:"",notes:"",aliases:"Old_1; Old_2",...changes}))d.set(k,v);return d;
}
test("catalog preserves unknown metadata and has no hours payload",()=>{
 const r=parseCatalogForm(data());assert.equal(r.code,"TEST_AUTO");assert.equal(r.year,null);assert.equal(r.serial,null);assert.deepEqual(r.aliases,["Old_1","Old_2"]);
 assert.equal("initial_hours" in r,false);assert.equal("confirmed" in r,false);
 assert.equal("initial_hours" in parseCatalogForm(data({initial_hours:"9999",baseline_confirmed:"on"})),false);
});
test("catalog rejects malformed codes, duplicate aliases and future years",()=>{
 assert.throws(()=>parseCatalogForm(data({code:"MÃ SAI"})));
 assert.throws(()=>parseCatalogForm(data({aliases:"old;OLD"})));
 assert.throws(()=>parseCatalogForm(data({year:String(new Date().getFullYear()+1)})));
 assert.throws(()=>parseCatalogForm(data({year:"2020.5"})));
 assert.throws(()=>parseCatalogForm(data({category:"UNKNOWN"})));
 assert.throws(()=>parseCatalogForm(data({base_status:"in_repair"})));
});
test("editing requires a version and catalog login redirect stays internal",()=>{
 assert.throws(()=>parseCatalogForm(data({equipment_id:"70000000-0000-0000-0000-000000000001"})));
 assert.equal(parseCatalogForm(data({equipment_id:"70000000-0000-0000-0000-000000000001",version:"2",baseline_confirmed:""})).version,2);
 assert.equal(safeNext("/catalog?workspace=test"),"/catalog?workspace=test");assert.equal(safeNext("/catalogue"),"/");assert.equal(safeNext("//external.invalid/catalog"),"/");
});
