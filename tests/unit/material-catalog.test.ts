import test from "node:test";
import assert from "node:assert/strict";
import {materialDuplicateGroups,materialIdentityKey} from "../../src/lib/material-catalog";

const row=(code:string,name:string,category:string|null)=>({code,name,unit:"Chiếc",equipment_category:category});

test("material identity keeps the same name in different equipment groups",()=>{
 const rows=[row("VT-QC-001","Vòng bi 6213","QC"),row("VT-RTG-001","Vòng bi 6213","RTG")];
 assert.equal(materialDuplicateGroups(rows).length,0);
});

test("material identity catches punctuation variants inside one equipment group",()=>{
 const rows=[row("VT-RTG-054","Xích nhựa (IGUS 4040HD.30.250.0)","RTG"),row("VT-RTG-055","Xích nhựa ((IGUS 4040HD.30.250.0))","RTG")];
 assert.deepEqual(materialDuplicateGroups(rows).map(group=>group.map(item=>item.code)),[["VT-RTG-054","VT-RTG-055"]]);
 assert.equal(materialIdentityKey(rows[0]),materialIdentityKey(rows[1]));
});

test("unclassified materials use the code prefix as their equipment group",()=>{
 assert.equal(materialDuplicateGroups([row("VT-KC-001","Rô tuyn",null),row("VT-QC-001","Rô tuyn",null)]).length,0);
 assert.equal(materialDuplicateGroups([row("VT-KC-001","Rô tuyn",null),row("VT-KC-002","Rô-tuyn",null)]).length,1);
});

