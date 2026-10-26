import {test,expect} from "@playwright/test";
import {buildSync} from "esbuild";
import {PDFDocument} from "pdf-lib";
const bundle=buildSync({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';
 import {RequisitionPlanForm} from './src/components/requisition-plan-form-v2';
 import {octoberMaintenancePlan} from './src/lib/maintenance-requisition-plan';
 const frameAliases={KHUNG57:['N57','No57'],KHUNG60:['N60','No60'],KHUNG64:['N64','No64'],KHUNG66:['N66','No66']};
 const equipment=octoberMaintenancePlan.map((r,i)=>{const alias=frameAliases[r.equipmentCode];return {id:'70000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),code:alias?.[0]??r.equipmentCode,name:alias?.[1]??r.sourceLabel,category:r.group};});
 window.requests=[];
 const save=async(data)=>{window.requests.push(Object.fromEntries(data));return window.requests.length===1?{ok:false,message:'Mất xác nhận, hãy gửi lại'}:{ok:true,message:'Đã lưu',id:'70000000-0000-4000-8000-000000000100'};};
 createRoot(document.getElementById('root')).render(<RequisitionPlanForm workspaceName="Fixture" workspace="70000000-0000-4000-8000-000000000101" equipment={equipment} materials={[]} today="2026-10-23" saveAction={save}/>);`,resolveDir:process.cwd(),loader:"tsx"},bundle:true,write:false,platform:"browser",format:"iife",jsx:"automatic",define:{"process.env.NODE_ENV":'"production"'}}).outputFiles[0].text;
for(const timezoneId of ["UTC","Asia/Ho_Chi_Minh"]){test.describe(timezoneId,()=>{
 test.use({timezoneId});
 test("current monthly form preserves both calendar dates and a retry opens the saved printable plan",async({page})=>{
  await page.goto("/login");await page.setContent('<main id="root"></main>');await page.addScriptTag({content:bundle});
  const pdf=await PDFDocument.create();pdf.addPage();
  await page.getByLabel("Tệp kế hoạch sửa chữa, bảo dưỡng tháng (.pdf)").setInputFiles({name:"fixture.pdf",mimeType:"application/pdf",buffer:Buffer.from(await pdf.save())});
  await expect(page.getByText("Đã chọn tệp:")).toBeVisible();
  await expect(page.locator(".voucher-preview")).toHaveCount(5);
  await expect(page.getByText("Tất cả phương tiện đã khớp danh mục.")).toBeVisible();
  await expect(page.getByText("No57, No60, No64, No66, Hpp 002",{exact:false}).first()).toBeVisible();
  await expect(page.locator(".voucher-preview").first()).toContainText("Ngày kế hoạch: 21/10/2026 · Ngày phiếu lĩnh: 23/10/2026");
  await expect(page.getByText("2 liên A5 · 1 tờ A4").first()).toBeVisible();
  await expect(page.getByText(/2 liên A4 · \d+ trang in/).first()).toBeVisible();
  const firstOil=page.getByRole("checkbox",{name:/P554004 · Lọc dầu máy: 1 chiếc/}).first();
  await firstOil.uncheck();
  await expect(page.locator(".voucher-preview").first().locator("tr",{hasText:"Lọc dầu máy"}).first()).toContainText("2");
  await firstOil.check();
  await page.getByLabel("Ngày lập phiếu lĩnh thực tế").fill("2026-10-24");
  await expect(page.locator(".voucher-preview").first()).toContainText("Ngày phiếu lĩnh: 24/10/2026");
  await page.getByRole("checkbox",{name:"RTG 06",exact:true}).uncheck();
  await expect(page.locator(".voucher-preview").first()).not.toContainText("RTG06");
  await page.getByRole("checkbox",{name:"RTG 06",exact:true}).check();
  await page.getByLabel("Ngày lập phiếu lĩnh thực tế").fill("2026-10-23");
  const save=page.getByRole("button",{name:"Xác nhận bố cục, lưu & tạo vụ việc"});
  await save.click();expect(await page.evaluate(()=>((window as unknown as {requests:unknown[]}).requests).length)).toBe(0);
  await page.getByRole("checkbox",{name:"Tôi đã đối chiếu tệp nguồn, phương tiện và số lượng xin lĩnh."}).check();
  await save.click();await expect(page.getByText("Mất xác nhận, hãy gửi lại")).toBeVisible();await save.click();
  await expect(page.getByRole("link",{name:/Mở kế hoạch đã lưu/})).toHaveAttribute("href","/requisitions/70000000-0000-4000-8000-000000000100");
  const requests=await page.evaluate(()=>((window as unknown as {requests:Record<string,string>[]}).requests));
  expect(requests).toHaveLength(2);expect(requests[0].request_key).toBe(requests[1].request_key);
  expect(requests[1].document_day).toBe("2026-10-23");expect(requests[1].planned_day).toBe("2026-10-21");
  const savedRows=JSON.parse(requests[1].rows) as {sourceLabel:string;equipmentCode:string;equipmentName:string}[];expect(savedRows.find(row=>row.sourceLabel==="Khung cẩu No57")).toMatchObject({equipmentCode:"N57",equipmentName:"No57"});
  await expect(page.getByLabel("Ngày lập phiếu lĩnh thực tế")).toBeDisabled();
 });
});}

