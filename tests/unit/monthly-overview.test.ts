import assert from "node:assert/strict";
import test from "node:test";
import {buildMonthlyMatrix,monthKeys} from "../../src/lib/monthly-overview";

test("monthKeys includes both boundary months",()=>{
 assert.deepEqual(monthKeys("2025-11","2026-02"),["2025-11","2025-12","2026-01","2026-02"]);
});

test("monthly matrix preserves missing values instead of treating them as zero",()=>{
 const result=buildMonthlyMatrix([{id:"e1",code:"RTG01",category:"RTG"},{id:"e2",code:"RTG02",category:"RTG"}],[{equipment_id:"e1",equipment_code:"RTG01",month:"2026-01-01",operating_hours:12,boxes:3}], ["2026-01"]);
 assert.equal(result.rows[1].cells[0].hours,null);
 assert.equal(result.totals[0].hours,12);
 assert.equal(result.totals[0].missing,1);
});

