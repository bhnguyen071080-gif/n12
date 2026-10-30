import {test} from "node:test";
import assert from "node:assert/strict";
import {documentPayloadFields} from "../../src/lib/documents";
import {uuid} from "../../src/lib/domain";

test("database identifiers retain the existing UUID-shaped input contract",()=>{
 assert.equal(uuid.safeParse("00000000-0000-0000-0000-000000000001").success,true);
 assert.equal(uuid.safeParse("70000000-0000-4000-8000-000000000001").success,true);
 assert.equal(uuid.safeParse("not-a-uuid").success,false);
 assert.equal(uuid.safeParse("70000000-0000-4000-8000-00000000000z").success,false);
});

test("oversized document lines are rejected before inspecting their contents",()=>{
 const hostileLine={get name(){throw new Error("Oversized input must not be traversed");}};
 const result=documentPayloadFields.shape.lines.safeParse(Array(151).fill(hostileLine));
 assert.equal(result.success,false);
 if(!result.success){
  assert.equal(result.error.issues.length,1);
  assert.equal(result.error.issues[0].code,"too_big");
 }
});
