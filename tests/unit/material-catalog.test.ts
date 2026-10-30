import test from "node:test";
import assert from "node:assert/strict";
import {filterMaterialCatalog,materialCatalogStats,materialDuplicateGroups,materialIdentityKey,type MaterialCatalogRow} from "../../src/lib/material-catalog";

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

const catalogRows:MaterialCatalogRow[]=[
 {id:"1",code:"VT-QC-001",name:"Vòng bi 6213",unit:"Vòng",equipment_category:"QC",service_limit_hours:1200},
 {id:"2",code:"VT-QC-002",name:"Vòng-bi 6213",unit:"Vòng",equipment_category:"QC",service_limit_hours:null},
 {id:"3",code:"VT-RTG-001",name:"Vòng bi 6213",unit:"Vòng",equipment_category:"RTG",service_limit_hours:800},
 {id:"4",code:"VT-KC-001",name:"Phớt 90x120x12",unit:"Cái",equipment_category:null,service_limit_hours:null}
];

test("catalog stats distinguish classified, unclassified and duplicated records",()=>{
 const stats=materialCatalogStats(catalogRows);
 assert.deepEqual({total:stats.total,categorized:stats.categorized,unclassified:stats.unclassified,withLimit:stats.withLimit},{total:4,categorized:3,unclassified:1,withLimit:2});
 assert.deepEqual([...stats.duplicateIds].sort(),["1","2"]);
});

test("catalog filter searches Vietnamese text and supports data-quality views",()=>{
 assert.deepEqual(filterMaterialCatalog(catalogRows,{query:"phot 90",category:"",quality:"",sort:"name"}).map(item=>item.id),["4"]);
 assert.deepEqual(filterMaterialCatalog(catalogRows,{query:"",category:"QC",quality:"duplicate",sort:"code"}).map(item=>item.id),["1","2"]);
 assert.deepEqual(filterMaterialCatalog(catalogRows,{query:"",category:"",quality:"without_limit",sort:"code"}).map(item=>item.id),["4","2"]);
});

test("catalog sort can prioritize the highest service limit",()=>{
 assert.deepEqual(filterMaterialCatalog(catalogRows,{query:"",category:"",quality:"with_limit",sort:"limit"}).map(item=>item.id),["1","3"]);
});

