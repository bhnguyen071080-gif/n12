import test from "node:test";
import assert from "node:assert/strict";
import {zipSync,strToU8} from "fflate";
import {extractImportXml} from "../../src/lib/xlsx-import";
import {importTemplateBase64} from "../../src/lib/import-template.generated";
test("blank generated workbook is bounded and includes expected data sheets and validation",()=>{
 const bytes=Buffer.from(importTemplateBase64,"base64"),files=extractImportXml(bytes);
 assert.ok(files["xl/workbook.xml"].includes("Phương tiện"));assert.ok(files["xl/workbook.xml"].includes("Hướng dẫn"));
 assert.ok(files["xl/worksheets/sheet1.xml"].includes("dataValidation"));
 assert.ok(files["xl/workbook.xml"].includes("Giờ hoạt động"));
});
test("oversize archives, macros and oversized XML parts are rejected before expansion",()=>{
 assert.throws(()=>extractImportXml(new Uint8Array(1048577)));
 assert.throws(()=>extractImportXml(zipSync({'xl/vbaProject.bin':strToU8('macro')})));
 assert.throws(()=>extractImportXml(zipSync({'xl/worksheets/sheet1.xml':strToU8('x'.repeat(4000001))})));
 assert.throws(()=>extractImportXml(new Uint8Array([1,2,3])));
});
