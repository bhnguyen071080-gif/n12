import {test,expect} from "@playwright/test";

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
