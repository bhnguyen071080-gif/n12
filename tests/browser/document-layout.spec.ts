import {test,expect} from "@playwright/test";
import {execFileSync} from "node:child_process";
import {documentFixture} from "../fixtures/document";
import {PDFDocument,PDFArray,PDFDict,PDFName,PDFString,PDFHexString} from "pdf-lib";

function paperHtml(payload:ReturnType<typeof documentFixture>["payload"]){
 // Playwright's JSX transform produces locator objects, not React elements.
 return execFileSync(process.execPath,["--import","tsx","--eval",`const {createElement}=require("react");const {renderToStaticMarkup}=require("react-dom/server");const {ConditionMinutesPaper}=require("./src/components/condition-minutes-paper.tsx");process.stdout.write(renderToStaticMarkup(createElement(ConditionMinutesPaper,{payload:${JSON.stringify(payload)}})));`],{encoding:"utf8"});
}

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
 const html=paperHtml(payload);
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

test("equipment history prints a complete grid with rows fitted to their content",async({page})=>{
 await page.goto("/login");
 const styles=await page.locator('link[rel="stylesheet"]').evaluateAll(links=>links.map(link=>(link as HTMLLinkElement).href));
 await page.setContent(`<!doctype html><html lang="vi"><head>${styles.map(href=>`<link rel="stylesheet" href="${href}">`).join("")}</head><body>
 <main class="app-main"><section class="panel history-sheet"><header><h2>SỬA CHỮA, THAY THẾ, CẢI TẠO CÁC BỘ PHẬN CƠ CẤU CỦA MÁY TRỤC RTG06</h2></header>
 <div class="overflow-x-auto"><table class="history-table"><thead><tr><th>Ngày, tháng, năm</th><th>Nội dung sửa chữa thay thế cải tạo</th><th>Chữ ký của người chịu trách nhiệm về hoạt động và an toàn máy trục</th></tr></thead><tbody>
 <tr data-row="short"><td>10/01/2022</td><td><p>Kiểm tra vi AVR</p></td><td><span class="signature-space" aria-label="Ô chữ ký"></span></td></tr>
 <tr data-row="long"><td>11/01/2022</td><td><p>Tháo cuộn kích từ, kiểm tra toàn bộ cụm phát điện và thay thế chi tiết hư hỏng. Nội dung dài được tự động xuống dòng để chiều cao ô chỉ tăng theo phần chữ thực tế cần hiển thị.</p></td><td><span class="signature-space" aria-label="Ô chữ ký"></span></td></tr>
 </tbody></table></div></section></main></body></html>`,{waitUntil:"networkidle"});
 await page.emulateMedia({media:"print"});
 const metrics=await page.evaluate(()=>{
  const table=document.querySelector<HTMLElement>('.history-table')!;
  const shortRow=document.querySelector<HTMLElement>('[data-row="short"]')!;
  const longRow=document.querySelector<HTMLElement>('[data-row="long"]')!;
  const cells=[...document.querySelectorAll<HTMLElement>('.history-table th,.history-table td')];
  return {
   collapse:getComputedStyle(table).borderCollapse,
   shortHeight:shortRow.getBoundingClientRect().height,
   longHeight:longRow.getBoundingClientRect().height,
   borders:cells.map(cell=>({top:getComputedStyle(cell).borderTopStyle,right:getComputedStyle(cell).borderRightStyle,bottom:getComputedStyle(cell).borderBottomStyle,left:getComputedStyle(cell).borderLeftStyle,width:parseFloat(getComputedStyle(cell).borderLeftWidth)})),
   vertical:cells.map(cell=>getComputedStyle(cell).verticalAlign),
   signatureMinHeight:getComputedStyle(document.querySelector('.signature-space')!).minHeight
  };
 });
 expect(metrics.collapse).toBe("collapse");
 expect(metrics.borders.every(border=>border.top==="solid"&&border.right==="solid"&&border.bottom==="solid"&&border.left==="solid"&&border.width>0)).toBe(true);
 expect(metrics.vertical.every(value=>value==="middle")).toBe(true);
 expect(metrics.signatureMinHeight).toBe("0px");
 expect(metrics.shortHeight).toBeLessThan(metrics.longHeight);
 expect(metrics.shortHeight).toBeLessThan(45);
});

test("multi-page A4 minutes move every signature element together, with or without signer names",async({page},testInfo)=>{
 await page.goto("/login");
 const styles=await page.locator('link[rel="stylesheet"]').evaluateAll(links=>links.map(link=>(link as HTMLLinkElement).href));
 await page.setViewportSize({width:718,height:972});
 await page.emulateMedia({media:"print"});
 for(const count of [1,12,35])for(const named of [true,false]){
  const payload=documentFixture("condition_minutes",count).payload;
  payload.participants=payload.participants.slice(0,2).map((group,i)=>({...group,unit:i===0?"Phòng kỹ thuật":"Đội vận hành thử nghiệm",members:`[TV-EAM:DAI-DIEN:1]\n1. Ông: SIGNER_TEST_${i} — Test role${named?" [Đại diện ký]":""}`}));
  const html=paperHtml(payload);
  await page.setContent(`<!doctype html><html lang="vi"><head>${styles.map(href=>`<link rel="stylesheet" href="${href}">`).join("")}<style>@media print{body{width:190mm}}</style></head><body><main class="document-page">${html}</main></body></html>`,{waitUntil:"networkidle"});
  if(count===1){const shortPdf=await PDFDocument.load(await page.pdf({preferCSSPageSize:true}));expect(shortPdf.getPageCount()).toBe(1);}
  const position=await page.evaluate(()=>{
   const block=document.querySelector<HTMLElement>('.paper-signature-block')!;
   const paper=document.querySelector('.condition-paper')!;
   const offset=block.getBoundingClientRect().top-paper.getBoundingClientRect().top;
   const height=block.getBoundingClientRect().height;
   const usablePageHeight=257*96/25.4;
   // Put the nominal start half a signing block before a page boundary.
   // These test-only links expose actual PDF page placement, not DOM offsets.
   const target=Math.ceil((offset+height/2)/usablePageHeight)*usablePageHeight-height/2;
   const spacer=document.createElement('div');spacer.style.height=`${Math.max(0,target-offset)}px`;block.before(spacer);
   block.querySelectorAll('.paper-signature-heading,.paper-signatures p,.paper-signature-space,.paper-signer-name').forEach((el,i)=>{
    const marker=document.createElement('a');marker.href=`https://example.invalid/signature-part-${i}`;
    marker.style.cssText='display:block;color:inherit;text-decoration:none;height:100%';
    while(el.firstChild)marker.append(el.firstChild);el.append(marker);
   });
   return {expectedFirstPage:Math.floor(target/usablePageHeight)+1,display:getComputedStyle(block).display};
  });
  expect(position.display).toBe("inline-block");
  const bytes=await page.pdf({preferCSSPageSize:true,printBackground:true});
  const pdf=await PDFDocument.load(bytes);
  const markerPages:number[]=[];const markers=new Set<string>();
  for(const [index,pdfPage] of pdf.getPages().entries()){
   const annotations=pdfPage.node.lookupMaybe(PDFName.of("Annots"),PDFArray);
   for(const ref of annotations?.asArray()||[]){
    const annotation=pdf.context.lookup(ref,PDFDict),action=annotation.lookupMaybe(PDFName.of("A"),PDFDict);
    const uri=action?.lookup(PDFName.of("URI"));
    if(uri instanceof PDFString||uri instanceof PDFHexString){const value=uri.decodeText();if(value.startsWith("https://example.invalid/signature-part-")){markerPages.push(index);markers.add(value);}}
   }
  }
  expect(markers.size).toBeGreaterThanOrEqual(named?6:4);
  expect(new Set(markerPages).size).toBe(1);
  // Repeated table headings and intact rows can move long tables further.
  expect(markerPages[0]).toBeGreaterThanOrEqual(position.expectedFirstPage);
  if(count===1)expect(markerPages[0]).toBe(position.expectedFirstPage);
  const size=pdf.getPage(0).getSize();expect(size.width).toBeCloseTo(595.28,0);expect(size.height).toBeCloseTo(841.89,0);
  if(count===12&&named)await testInfo.attach("multi-page-minutes-synthetic.pdf",{body:Buffer.from(bytes),contentType:"application/pdf"});
 }
});
