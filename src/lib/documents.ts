import {z} from "zod";
import {actualTimestamp,uuid} from "./domain";
import {parseRepresentatives,structuredRepresentatives} from "./document-people";

const text=(max:number)=>z.string().trim().max(max).refine(s=>!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s),"Ký tự điều khiển không hợp lệ");
const required=(max:number)=>text(max).refine(s=>s.length>0,"Không được để trống");
const quantity=z.number().finite().nonnegative().max(1e7).refine(n=>Math.abs(n*1000-Math.round(n*1000))<1e-5,"Tối đa 3 số lẻ");
export const documentKinds=["condition_minutes","material_requisition"] as const;
export const documentKindLabels={condition_minutes:"Biên bản xác định tình trạng",material_requisition:"Phiếu lĩnh vật tư"};
export const participantSchema=z.object({unit:text(200),members:text(1000)}).strict().superRefine((group,context)=>{
 if(!structuredRepresentatives(group.members))return;
 const people=parseRepresentatives(group.members);
 if(people.length>10)context.addIssue({code:z.ZodIssueCode.custom,message:"Mỗi đơn vị tối đa 10 người",path:["members"]});
 if(people.some(person=>!person.name.trim()))context.addIssue({code:z.ZodIssueCode.custom,message:"Nhập họ tên người tham gia, không chỉ ghi chức danh",path:["members"]});
 if(people.filter(person=>person.signs).length>1)context.addIssue({code:z.ZodIssueCode.custom,message:"Mỗi đơn vị chỉ chọn một người đại diện ký",path:["members"]});
});
export const documentLineSchema=z.object({
 usage_id:uuid.nullable(),name:required(500),specification:text(500),catalogue_code:text(100),unit:required(40),
 requested:quantity.refine(n=>n>0,"Số xin lĩnh phải lớn hơn 0"),issued:quantity.nullable(),
 unit_price:z.number().finite().nonnegative().int().max(1e12).nullable(),
 limit_text:text(200),used_text:text(200),condition:text(4000),notes:text(1000)
}).strict().refine(l=>l.unit_price===null||l.issued===null||Number.isSafeInteger(Math.round(l.issued*l.unit_price)),"Thành tiền vượt phạm vi an toàn");
export const documentPayloadSchema=z.object({
 schema_version:z.literal(1),kind:z.enum(documentKinds),company:required(200),department:required(200),
 unit:required(200),location:required(200),form_code:text(50),document_number:text(100),
 document_at:text(16).refine(s=>{try{actualTimestamp(s);return true;}catch{return false;}},"Ngày giờ lập không hợp lệ"),
 equipment_label:required(300),inspection_subject:text(1500),reason:text(1500),warehouse:text(200),
 participants:z.array(participantSchema).max(3),cause:text(8000),solution:text(8000),
 signer_names:z.array(text(100)).length(5),amount_words:text(1000),
 lines:z.array(documentLineSchema).max(150)
}).strict().superRefine((d,c)=>{
 if(d.kind==="material_requisition"&&!d.lines.length)c.addIssue({code:z.ZodIssueCode.custom,message:"Chọn ít nhất một dòng vật tư",path:["lines"]});
 const linked=d.lines.filter(l=>l.usage_id!==null);
 if(d.kind==="material_requisition"&&linked.length!==d.lines.length)c.addIssue({code:z.ZodIssueCode.custom,message:"Phiếu lĩnh chỉ được chọn vật tư đã gắn với vụ việc",path:["lines"]});
 if(new Set(linked.map(l=>l.usage_id)).size!==linked.length)c.addIssue({code:z.ZodIssueCode.custom,message:"Dòng vật tư trùng",path:["lines"]});
 const total=d.lines.reduce((sum,l)=>sum+(l.unit_price===null||l.issued===null?0:Math.round(l.unit_price*l.issued)),0);
 if(!Number.isSafeInteger(total))c.addIssue({code:z.ZodIssueCode.custom,message:"Tổng tiền vượt phạm vi an toàn",path:["lines"]});
});
export type DocumentPayload=z.infer<typeof documentPayloadSchema>;
export type DocumentLine=z.infer<typeof documentLineSchema>;
export function inspectionLine(name="",condition=""):DocumentLine{
 return {usage_id:null,name,specification:"",catalogue_code:"",unit:"",requested:1,issued:null,unit_price:null,limit_text:"",used_text:"",condition,notes:""};
}
export const documentSourceSchema=z.object({case_id:uuid,case_code:z.string(),order_code:z.string(),equipment_id:uuid,equipment_code:z.string(),equipment_name:z.string()}).strict();
export type DocumentSource=z.infer<typeof documentSourceSchema>;
export const snapshotSchema=z.object({payload:documentPayloadSchema,source:documentSourceSchema,source_hash:z.string().regex(/^[a-f0-9]{64}$/),layout_version:z.literal("tv-eam-print-1")}).strict();
export type DocumentSnapshot=z.infer<typeof snapshotSchema>;
export type CaseDocument={id:string;workspace_id:string;case_id:string;kind:DocumentPayload["kind"];revision:number;request_key:string;created_by:string;created_at:string;snapshot:unknown;drive_file_id:string|null;drive_state:"pending"|"uploading"|"saved";drive_lease:string|null;drive_lease_until:string|null;drive_pdf_sha256:string|null};

export function decodeDocumentPayload(value:string):DocumentPayload{
 if(value.length>400000)throw new Error("Hồ sơ quá lớn");
 const input:unknown=JSON.parse(value);return documentPayloadSchema.parse(input);
}
export function documentFilename(source:DocumentSource,kind:DocumentPayload["kind"],revision:number):string{
 const safe=source.case_code.replace(/[^A-Za-z0-9_-]/g,"_").slice(0,120);
 return `${kind==="condition_minutes"?"BB":"PL"}-${safe}-v${revision}.pdf`;
}
export function issuedAmount(line:DocumentLine):number|null{
 return line.issued===null||line.unit_price===null?null:Math.round(line.issued*line.unit_price);
}
export function knownTotal(lines:DocumentLine[]):number|null{
 const values=lines.map(issuedAmount);
 return values.some(v=>v===null)?null:values.reduce<number>((sum,v)=>sum+(v??0),0);
}
