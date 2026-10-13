import {test,expect} from "@playwright/test";
test("configuration gate works without cloud credentials",async({page})=>{
 await page.goto("/");await expect(page).toHaveURL(/setup/);await expect(page.getByRole("heading",{name:"TV-EAM chưa kết nối dữ liệu đám mây"})).toBeVisible();
});
test("mobile login labels and no-secret QR gate",async({page,request})=>{
 await page.setViewportSize({width:390,height:844});await page.goto("/login?next=%2Fequipment%2FQC10%3Faction%3Dquick-inspect");
 await expect(page.getByLabel("Email")).toBeVisible();await expect(page.getByLabel("Mật khẩu")).toBeVisible();
 await expect(page.getByRole("button",{name:"Đăng nhập",exact:true})).toBeVisible();
 const response=await request.get("/api/equipment/QC10/qr?workspace=00000000-0000-0000-0000-000000000001");expect(response.status()).toBe(503);
});
test("PWA shell does not cache business records",async({request})=>{
 const manifest=await request.get("/manifest.webmanifest");expect(manifest.status()).toBe(200);
 const sw=await request.get("/sw.js");expect(await sw.text()).toContain("No caching of API calls");
});

test("personal cases and month filters stay behind cloud configuration gate",async({page})=>{
 for(const path of ["/cases","/cases/e0000000-0000-0000-0000-000000000001","/cases/e0000000-0000-0000-0000-000000000001/documents","/monthly?kind=hours","/life"]){
  await page.goto(path);await expect(page).toHaveURL(/setup/);
 }
});
test("PDF endpoints do not disclose data without a configured backend",async({request})=>{
 const r=await request.get("/api/documents/00000000-0000-4000-8000-000000000001/pdf");expect(r.status()).toBe(503);
 const bad=await request.get("/api/documents/not-a-uuid/pdf");expect(bad.status()).toBe(400);
});
