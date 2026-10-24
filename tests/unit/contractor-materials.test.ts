import assert from "node:assert/strict";
import test from "node:test";
import {addWarrantyMonths,formatDateVi,warrantyState} from "../../src/lib/contractor-materials";

test("warranty end follows spreadsheet EDATE month clamping",()=>{
 assert.equal(addWarrantyMonths("2025-12-10",3),"2026-03-10");
 assert.equal(addWarrantyMonths("2026-01-31",1),"2026-02-28");
 assert.equal(addWarrantyMonths("2025-10-24",0),"2025-10-24");
});
test("warranty alerts match VT_DVSC 30-day rule",()=>{
 assert.equal(warrantyState("2026-10-23","2026-10-24"),"expired");
 assert.equal(warrantyState("2026-11-23","2026-10-24"),"due_soon");
 assert.equal(warrantyState("2026-11-24","2026-10-24"),"active");
 assert.equal(formatDateVi("2026-03-10"),"10/03/2026");
});

