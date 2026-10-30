import test from "node:test";
import assert from "node:assert/strict";
import {paginate} from "../../src/lib/pagination";

test("paginate giới hạn đúng số dòng và trang",()=>{
 const rows=Array.from({length:357},(_,index)=>index+1);
 const result=paginate(rows,2,50);
 assert.equal(result.page,2);
 assert.equal(result.pages,8);
 assert.deepEqual(result.items,[...Array(50)].map((_,index)=>index+51));
});

test("paginate tự đưa trang vượt giới hạn về trang cuối",()=>{
 const result=paginate([1,2,3],99,2);
 assert.equal(result.page,2);
 assert.deepEqual(result.items,[3]);
});

