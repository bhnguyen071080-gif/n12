type RequestCrypto=Pick<Crypto,"getRandomValues">&Partial<Pick<Crypto,"randomUUID">>;
// Cryptographically random UUID v4, including browsers without randomUUID().
export function createRequestKey(source:RequestCrypto=globalThis.crypto):string{
 if(!source || typeof source.getRandomValues!=="function")throw new Error("BROWSER_REQUEST_ID_UNAVAILABLE");
 if(typeof source.randomUUID==="function"){
  try{return source.randomUUID();}catch{/* Use the standard secure random-values API below. */}
 }
 const bytes=source.getRandomValues(new Uint8Array(16));
 bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const h=Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
 return h.slice(0,8)+"-"+h.slice(8,12)+"-"+h.slice(12,16)+"-"+h.slice(16,20)+"-"+h.slice(20);
}
