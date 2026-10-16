import test from "node:test";
import assert from "node:assert/strict";
import {newRowsOnly} from "../../src/lib/simple-import";
import type {ImportPlan} from "../../src/lib/table-import";
const row=(action:ImportPlan['action']):ImportPlan=>({action,row:{code:'TEST',name:'Thử',unit:'bộ'},expected:null,previous:null});
test('direct import adds only new rows and skips identical existing rows',()=>{
 const p=newRowsOnly([row('add'),row('same')]);assert.equal(p.rows.length,1);assert.equal(p.unchanged,1);
 assert.deepEqual(p.rows[0],{row:row('add').row,expected:null});
 assert.equal(newRowsOnly([row('same')]).rows.length,0);
});
test('direct import never silently overwrites an existing changed row',()=>{
 assert.throws(()=>newRowsOnly([row('add'),row('update')]),/Chưa nhập dòng nào/);
});
