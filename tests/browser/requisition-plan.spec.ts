import {test,expect} from "@playwright/test";
import {buildSync} from "esbuild";

// Mount the real client component with an empty synthetic catalog. No cloud
// login, saved records or write endpoint is involved in this preview-only flow.
const bundle=buildSync({
 stdin:{contents:`import React from 'react';
 import {createRoot} from 'react-dom/client';
 import {RequisitionPlanForm} from './src/components/requisition-plan-form';
 createRoot(document.getElementById('root')).render(<RequisitionPlanForm workspaceName="Test workspace" equipmentCodes={[]}/>);`,resolveDir:process.cwd(),loader:"tsx"},
 bundle:true,write:false,platform:"browser",format:"iife",jsx:"automatic",
 define:{"process.env.NODE_ENV":'"production"'},
}).outputFiles[0].text;

for(const timezoneId of ["UTC","Asia/Ho_Chi_Minh"]){
 test.describe(timezoneId,()=>{
  test.use({timezoneId});
  test("preview groups interactively, keeps selected date and clears stale results",async({page})=>{
   await page.goto("/login");
   const styles=await page.locator('link[rel="stylesheet"]').evaluateAll(links=>links.map(link=>(link as HTMLLinkElement).href));
   await page.setContent(`<!doctype html><html lang="vi"><head>${styles.map(href=>`<link rel="stylesheet" href="${href}">`).join("")}</head><body><main id="root"></main></body></html>`);
   await page.addScriptTag({content:bundle});
   const submit=page.getByRole("button",{name:"Tính và xem trước phiếu"});
   const vouchers=page.locator(".voucher-preview");
   await page.getByLabel("Ngày dự kiến thực hiện").fill("2026-10-21");
   await submit.click();await expect(vouchers).toHaveCount(5);
   await expect(vouchers.first()).toContainText("Ngày dự kiến: 21/10/2026");
   await page.getByRole("radio",{name:"Theo từng phương tiện",exact:true}).check();
   await expect(vouchers).toHaveCount(0);
   await submit.click();await expect(vouchers).toHaveCount(57);
   await page.getByRole("radio",{name:"Theo ngày cùng thực hiện",exact:true}).check();
   await submit.click();await expect(vouchers).toHaveCount(2);
   await expect(vouchers.first().locator("header")).toContainText("Ngày 21/10/2026");
   await expect(vouchers.first()).toContainText("P554004");
   await expect(vouchers.last()).toContainText("Mỡ EPL2");
   await page.getByLabel("Ngày dự kiến thực hiện").fill("2026-10-31");
   await expect(vouchers).toHaveCount(0);
   await submit.click();await expect(vouchers).toHaveCount(2);
   for(const voucher of await vouchers.all())await expect(voucher).toContainText("Ngày dự kiến: 31/10/2026");
   for(const checkbox of await page.getByRole("checkbox").all())await checkbox.uncheck();
   await expect(submit).toBeDisabled();await expect(vouchers).toHaveCount(0);
   await page.getByRole("checkbox",{name:/^RTG/}).check();
   await submit.click();await expect(vouchers).toHaveCount(2);
   await expect(vouchers.last()).not.toContainText("TUKAN");
  });
 });
}
