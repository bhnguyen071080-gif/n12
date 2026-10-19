import {test,expect} from "@playwright/test";
import {execFileSync} from "node:child_process";
import {documentFixture} from "../fixtures/document";

test("wide inspection tables never stretch the document fields outside the viewport",async({page})=>{
 await page.goto("/login");
 const styles=await page.locator('link[rel="stylesheet"]').evaluateAll(links=>links.map(link=>(link as HTMLLinkElement).href));
 expect(styles.length).toBeGreaterThan(0);
 // Synthetic shell only: no login, records, server action, or business data.
 await page.setContent(`<!doctype html><html lang="vi"><head>${styles.map(href=>`<link rel="stylesheet" href="${href}">`).join("")}</head><body>
 <div class="app-shell"><aside class="sidebar">Menu</aside><div class="app-body"><main class="app-main">
 <section class="panel document-editor"><form><fieldset><h3>Thông tin biểu mẫu</h3>
 <div class="grid gap-3 md:grid-cols-2"><label>Cơ quan<input value="Synthetic company"></label><label>Phòng<input value="Synthetic department"></label></div>
 <div class="representative-table-scroll"><table class="representative-table"><tbody><tr><td>Synthetic representative</td></tr></tbody></table></div>
 <div class="inspection-table-scroll"><table class="inspection-table"><tbody><tr><td>Synthetic inspection</td></tr></tbody></table></div>
 </fieldset></form></section></main></div></div></body></html>`,{waitUntil:"networkidle"});
 for(const width of [390,900,1101,1440]){
  await page.setViewportSize({width,height:900});
  const metrics=await page.evaluate(()=>{
   const fields=[...document.querySelectorAll('.document-editor .grid input')].map(el=>el.getBoundingClientRect());
   const table=document.querySelector('.inspection-table-scroll')!;
   return {pageWidth:document.documentElement.scrollWidth,viewport:innerWidth,leftWidth:fields[0].width,rightWidth:fields[1].width,rightEdge:fields[1].right,fieldsetMinimum:getComputedStyle(document.querySelector('fieldset')!).minInlineSize,tableScrolls:table.scrollWidth>table.clientWidth};
  });
  expect(metrics.pageWidth).toBeLessThanOrEqual(metrics.viewport);
  expect(metrics.rightEdge).toBeLessThanOrEqual(metrics.viewport);
  expect(Math.abs(metrics.leftWidth-metrics.rightWidth)).toBeLessThan(2);
  expect(metrics.fieldsetMinimum).toBe("0px");
  expect(metrics.tableScrolls).toBe(true);
 }
});

test("A4 minutes keep a compact title, borderless people and aligned name-only signature blocks",async({page})=>{
 await page.goto("/login");
 const styles=await page.locator('link[rel="stylesheet"]').evaluateAll(links=>links.map(link=>(link as HTMLLinkElement).href));
 const payload=documentFixture("condition_minutes",1).payload;
 payload.company="CÔNG TY CỔ PHẦN DOANH NGHIỆP MẪU";
 payload.participants=payload.participants.slice(0,2);
 // Playwright transforms JSX into its own locator objects. Render in the same
 // tsx runtime as the unit suite, then test the real component's HTML and CSS.
 const html=execFileSync(process.execPath,["--import","tsx","--eval",`const {createElement}=require("react");const {renderToStaticMarkup}=require("react-dom/server");const {ConditionMinutesPaper}=require("./src/components/condition-minutes-paper.tsx");process.stdout.write(renderToStaticMarkup(createElement(ConditionMinutesPaper,{payload:${JSON.stringify(payload)}})));`],{encoding:"utf8"});
 await page.setContent(`<!doctype html><html lang="vi"><head>${styles.map(href=>`<link rel="stylesheet" href="${href}">`).join("")}</head><body><main class="document-page">${html}</main></body></html>`,{waitUntil:"networkidle"});
 await page.emulateMedia({media:"print"});
 expect(await page.locator('.paper-people thead').count()).toBe(0);
 expect(await page.locator('.paper-inspection-intro').innerText()).toContain(payload.equipment_label);
 expect(await page.locator('.paper-inspection-intro').innerText()).not.toContain(payload.inspection_subject);
 expect(await page.locator('.paper-signatures').innerText()).not.toContain("Chức danh thử nghiệm");
 const metrics=await page.evaluate(()=>{
  const title=[...document.querySelectorAll('.paper-title > *')].map(el=>({margin:getComputedStyle(el).margin,line:getComputedStyle(el).lineHeight,size:getComputedStyle(el).fontSize}));
  const signatureHeadings=[...document.querySelectorAll('.paper-signature-heading')].map(el=>el.getBoundingClientRect().top);
  return {title,signatureHeadings,underline:getComputedStyle(document.querySelector('.paper-underlined')!,"::after").borderBottomStyle};
 });
 for(const line of metrics.title){expect(line.margin).toBe("0px");expect(parseFloat(line.line)).toBeCloseTo(parseFloat(line.size),1);}
 expect(metrics.signatureHeadings[0]).toBeCloseTo(metrics.signatureHeadings[1],1);
 expect(metrics.underline).toBe("solid");
});
