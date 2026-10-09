import {defineConfig} from "@playwright/test";
export default defineConfig({testDir:"./tests/browser",use:{baseURL:"http://127.0.0.1:3000"},webServer:{command:"npm run start",url:"http://127.0.0.1:3000/setup",reuseExistingServer:false},reporter:"list"});
