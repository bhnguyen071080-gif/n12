export type Representative={salutation:"Ông"|"Bà"|"";name:string;title:string;signs:boolean};
const signingMark=" [Đại diện ký]";
const peopleTag="[TV-EAM:DAI-DIEN:1]",peoplePrefix=peopleTag+"\n";
export function structuredRepresentatives(members:string):boolean{return members===peopleTag||members.startsWith(peoplePrefix);}
export function blankRepresentative():Representative{return {salutation:"Ông",name:"",title:"",signs:false};}
// Keep the existing, human-readable members field so saved snapshots and the
// database contract remain compatible. Never publish a private address book.
export function parseRepresentatives(members:string):Representative[]{
 const structured=structuredRepresentatives(members);
 const body=structured?members.slice(peopleTag.length).replace(/^\n/,""):members;
 const lines=body.replace(/\\n/g,"\n").replace(/\r/g,"").split("\n").map(s=>s.trim()).filter(Boolean);
 const explicit=structured||lines.some(line=>line.endsWith(signingMark));
 return lines.map((line,index)=>{
  const signs=explicit?line.endsWith(signingMark):index===0;
  let text=line.endsWith(signingMark)?line.slice(0,-signingMark.length):line;
  text=text.replace(/^\d+[.)]\s*/,"");
  const prefix=/^(Ông|Bà)\s*:\s*/i.exec(text);
  const salutation:Representative["salutation"]=prefix?prefix[1].toLocaleLowerCase("vi")==="bà"?"Bà":"Ông":"";
  if(prefix)text=text.slice(prefix[0].length);
  const split=/(?:^|\s+)(?:—|–|-)\s+/.exec(text);
  return {salutation,name:(split?text.slice(0,split.index):text).trim(),title:split?text.slice(split.index+split[0].length).trim():"",signs};
 });
}
export function serializeRepresentatives(people:Representative[]):string{
 const body=people.filter(person=>person.name.trim()||person.title.trim()).map((p,i)=>{
  const clean=(value:string)=>value.replace(/[\r\n\t]/g," ").trim();
  return `${i+1}. ${p.salutation?p.salutation+": ":""}${clean(p.name)}${p.title.trim()?" — "+clean(p.title):""}${p.signs?signingMark:""}`;
 }).join("\n");
 return body?peoplePrefix+body:"";
}
export function representativeLabel(person:Representative):string{return `${person.salutation?person.salutation+": ":""}${person.name}`;}
export const representativeTitles=["Phó trưởng phòng Kỹ thuật","Nhân viên kỹ thuật","Phó giám đốc","Đội trưởng đội Cơ giới","Đội phó đội Cơ giới","Nhân viên kỹ thuật đội Cơ giới"];
