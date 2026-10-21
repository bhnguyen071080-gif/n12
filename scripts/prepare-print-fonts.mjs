import {createHash} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";

// Pin the upstream commit as well as the bytes: the distribution website changes.
// Public, licensed font assets only. Never download user documents in a build.
const source="https://raw.githubusercontent.com/notofonts/noto-fonts/ffebf8c1ee449e544955a7e813c54f9b73848eac/hinted/ttf/NotoSerif/";
const files=[
 ["NotoSerif-Regular.ttf","c8f669ceb2c9c60ccf55198b305e08a997ffca79a38cc7eeb551e643cbe66505"],
 ["NotoSerif-Bold.ttf","3b2086a869bcded2aeb4416fc281ceec9d6ce3c06756cda19f8f763636204e7d"]
];
const dir=join(process.cwd(),"assets/fonts");await mkdir(dir,{recursive:true});
const sha=data=>createHash("sha256").update(data).digest("hex");
for(const [name,expected] of files){
 const target=join(dir,name);let existing;
 try{existing=await readFile(target);}catch{/* An absent build asset may be downloaded. */}
 if(existing&&sha(existing)===expected)continue;
 const response=await fetch(source+name,{signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw new Error("Print font download failed: "+response.status);
 const data=Buffer.from(await response.arrayBuffer());
 if(data.length>2000000||sha(data)!==expected)throw new Error("Print font checksum mismatch; require reviewed asset update.");
 await writeFile(target,data);
}
console.log("Verified bundled print fonts; no private data downloaded.");
