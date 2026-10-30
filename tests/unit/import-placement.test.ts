import test from "node:test";
import assert from "node:assert/strict";
import {importDestination,canImportTable} from "../../src/lib/import-placement";
import {importKinds} from "../../src/lib/table-import";
test("old import links map to the owning page and exact panel without losing workspace",()=>{
 const workspace="00000000-0000-4000-8000-000000000001";
 for(const kind of importKinds){
  const u=new URL(importDestination(kind,workspace),"https://example.invalid");
  assert.equal(u.pathname,kind==="equipment"?"/catalog":kind==="materials"?"/materials":"/monthly");
  assert.equal(u.searchParams.get("workspace"),workspace);assert.equal(u.searchParams.get("import"),kind);
  assert.equal(u.hash,"#nhap-tu-tep-"+kind);
  if(u.pathname==="/monthly")assert.equal(u.searchParams.get("kind"),kind==="cargo"?"other":kind);
 }
 assert.equal(new URL(importDestination("equipment"),"https://example.invalid").searchParams.has("workspace"),false);
});
test("inline import controls keep the existing per-kind permission matrix",()=>{
 for(const kind of importKinds){
  assert.equal(canImportTable([],kind),false);assert.equal(canImportTable(["DOI_SAN_XUAT"],kind),false);
  assert.equal(canImportTable(["TRUONG_BO_PHAN_KY_THUAT"],kind),true);
  assert.equal(canImportTable(["CAN_BO_VAT_TU"],kind),kind==="materials");
  assert.equal(canImportTable(["KY_THUAT_VIEN"],kind),["hours","container","other"].includes(kind));
 }
});
