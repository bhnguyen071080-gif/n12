import assert from "node:assert/strict";
import test from "node:test";
import {addWarrantyMonths,formatDateVi,parseContractorImportGrid,warrantyState} from "../../src/lib/contractor-materials";

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
test("VT_DVSC import finds the real header after title rows and ignores derived status",()=>{
 const parsed=parseContractorImportGrid([["TỔNG HỢP"],[],["STT","Tên vật tư","Đơn vị","Số lượng","Mã PT","Phương tiện","Ngày ký","Thời gian BH","Ghi chú","Dự kiến"],["1","Vòng bi 6213","vòng",1,"R15","RTG15","10/12/2025",12,"Bộ ra vào","10/12/2026","Còn hạn"]]);
 assert.equal(parsed.issues.length,0);
 assert.deepEqual(parsed.rows[0],{line:4,source_no:"1",material_name:"Vòng bi 6213",unit:"vòng",quantity:1,equipment_code:"R15",equipment_name:"RTG15",signed_on:"2025-12-10",warranty_months:12,notes:"Bộ ra vào"});
});

