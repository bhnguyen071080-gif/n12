import test from "node:test";
import assert from "node:assert/strict";
import {createRequestKey} from "../../src/lib/request-key";
const fallback={getRandomValues<T extends ArrayBufferView|null>(array:T):T{if(!(array instanceof Uint8Array))throw new Error("unexpected array");array.fill(17);return array;}};
test("request key uses secure UUID API when available",()=>{
 assert.equal(createRequestKey({...fallback,randomUUID:()=>"70000000-0000-4000-8000-000000000001"}),"70000000-0000-4000-8000-000000000001");
});
test("secure fallback preserves UUID v4 version and variant",()=>{
 assert.equal(createRequestKey(fallback),"11111111-1111-4111-9111-111111111111");
 assert.equal(createRequestKey({...fallback,randomUUID:()=>{throw new Error("unsupported");}}),"11111111-1111-4111-9111-111111111111");
});
test("missing cryptographic random source never falls back to weak randomness",()=>{
 assert.throws(()=>createRequestKey({} as Crypto),/BROWSER_REQUEST_ID_UNAVAILABLE/);
});
