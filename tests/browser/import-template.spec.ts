import {test,expect} from "@playwright/test";
import {parseImportXml,extractImportXml} from "../../src/lib/xlsx-import";
import {parseImportGrid,importSpecs,importKinds} from "../../src/lib/table-import";
import {importTemplateBase64} from "../../src/lib/import-template.generated";
test("Excel download round-trips every blank template through browser XML parser",async({page,request})=>{
 const response=await request.get('/api/import-template');expect(response.status()).toBe(200);expect(response.headers()['content-disposition']).toContain('.xlsx');
 expect(await response.body()).toEqual(Buffer.from(importTemplateBase64,'base64'));
 const files=extractImportXml(await response.body());await page.goto('/login');
 for(const kind of importKinds){const grid=await page.evaluate(({files,name,fn})=>{const parse=(0,eval)('('+fn+')');return parse(files,name);},{files,name:importSpecs[kind].sheet,fn:parseImportXml.toString()});expect(grid[0]).toEqual(importSpecs[kind].headers);expect(parseImportGrid(grid,kind).issues[0].message).toContain('chưa có');}
});
test("browser Excel reader respects typed dates, identifiers, formulas and malformed XML",async({page})=>{
 await page.goto('/login');
 const files={
  'xl/workbook.xml':'<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Giờ hoạt động" r:id="rId1"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
  'xl/worksheets/sheet1.xml':'<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Mã phương tiện</t></is></c><c r="B1" t="inlineStr"><is><t>Tháng</t></is></c><c r="C1" t="inlineStr"><is><t>Giờ hoạt động</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>0001</t></is></c><c r="B2"><v>45292</v></c><c r="C2"><v>0</v></c></row></sheetData></worksheet>',
 };
 const run=async(parts:Record<string,string>)=>page.evaluate(({files,fn})=>{try{return {grid:(0,eval)('('+fn+')')(files,'Giờ hoạt động'),error:''};}catch(e){return {grid:[],error:String(e)};}},{files:parts,fn:parseImportXml.toString()});
 const good=await run(files);expect(good.grid[1]).toEqual(['0001','2024-01-01',0]);
 expect((await run({...files,'xl/worksheets/sheet1.xml':files['xl/worksheets/sheet1.xml'].replace('<v>0</v>','<f>SUM(A1)</f><v>0</v>')})).error).toContain('công thức');
 expect((await run({...files,'xl/workbook.xml':'<!DOCTYPE x><workbook/>'})).error).toContain('không hợp lệ');
});
