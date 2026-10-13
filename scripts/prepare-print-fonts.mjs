import {createHash} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";

// Public, licensed font assets only. Never download user documents in a build.
const files=[
 ["NotoSerif-Regular.ttf","a8723b852088276eb9900f0183eeac4de61fc6693ea4465e2df9c4d8e134b153"],
 ["NotoSerif-Bold.ttf","5c810609bfb7a58bd0a0acefccd4cca63be48c0a4735ff1370b8866fea050680"]
];
const dir=join(process.cwd(),"assets/fonts");await mkdir(dir,{recursive:true});
const sha=data=>createHash("sha256").update(data).digest("hex");
for(const [name,expected] of files){
 const target=join(dir,name);let existing;
 try{existing=await readFile(target);}catch{/* An absent build asset may be downloaded. */}
 if(existing&&sha(existing)===expected)continue;
 const response=await fetch("https://notofonts.github.io/latin-greek-cyrillic/fonts/NotoSerif/hinted/ttf/"+name,{signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw new Error("Print font download failed: "+response.status);
 const data=Buffer.from(await response.arrayBuffer());
 if(data.length>2000000||sha(data)!==expected)throw new Error("Print font checksum mismatch; require reviewed asset update.");
 await writeFile(target,data);
}
console.log("Verified bundled print fonts; no private data downloaded.");
