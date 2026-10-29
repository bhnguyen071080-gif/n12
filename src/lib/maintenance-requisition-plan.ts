export type PlanGroup="TUKAN"|"QC"|"RTG"|"KHUNG_CAU";
export type SupplySource="warehouse"|"maintenance_consumable";
export type VoucherGrouping="equipment"|"group"|"date";

export type PlannedMaterial={
 key:string;
 name:string;
 unit:string;
 quantity:number;
 source:SupplySource;
 catalogueCode?:string;
 specification?:string;
 materialFamily?:string;
 oilType?:string;
 oilSpecification?:string;
 demandBasis?:"plan_explicit"|"matched_rule"|"catalog_reference";
 sourcePage?:number;
 sourceRow?:string;
 sourceText?:string;
 equipmentCode?:string;
 equipmentLabel?:string;
};

export type MaintenancePlanRow={
 sourceLabel:string;
 equipmentCode:string;
 equipmentName?:string;
 group:PlanGroup;
 maintenanceLevel:"I - theo giờ"|"I - theo tháng"|"II";
 operatingReading?:string;
 materials:PlannedMaterial[];
};

export type VoucherPreview={
 id:string;
 source:SupplySource;
 scopeLabel:string;
 equipmentCodes:string[];
 equipmentLabels:string[];
 lines:PlannedMaterial[];
};

export type MaintenancePlanFilter={
 groups?:readonly PlanGroup[];
 equipmentCodes?:readonly string[];
 sources?:readonly SupplySource[];
 materialCodes?:readonly string[];
 oilType?:string;
 oilSpecification?:string;
 search?:string;
};

export type PlanLine={
 id:string;
 plan:MaintenancePlanRow;
 material:PlannedMaterial;
};

export type VoucherBuildOptions={
 period?:string;
 selectedLineIds?:ReadonlySet<string>;
 strictBoundaries?:boolean;
 splitByManufacturer?:boolean;
 equipmentManufacturers?:ReadonlyMap<string,string>;
};

export type VoucherPrintPlan={
 mode:"two-copies-one-page"|"one-copy-per-page"|"requires-split";
 physicalPages:number;
 estimatedCopyHeightMm:number;
 fillPercent:number;
 explanation:string;
};

export type MaterialNeed={
 id:string;
 catalogueCode?:string;
 name:string;
 specification?:string;
 unit:string;
 quantity:number;
 details:{equipmentCode:string;quantity:number;sourceLabel:string}[];
};

export const planGroupLabels:Record<PlanGroup,string>={
 TUKAN:"TUKAN",
 QC:"QC",
 RTG:"RTG",
 KHUNG_CAU:"Khung cẩu",
};

export const supplySourceLabels:Record<SupplySource,string>={
 warehouse:"Vật tư kho vật tư",
 maintenance_consumable:"Nguyên liệu, nhiên liệu bảo dưỡng",
};

// Ngày ký/phát hành ghi trên đầu tệp PDF kế hoạch tháng 10/2026.
// Đây là ngày nguồn của kế hoạch, không phải ngày lập từng phiếu lĩnh.
export const octoberPlanDocumentDay="2026-10-01";

const materialCatalog={
 hydraulic:{key:"hydraulic-oil",name:"Dầu thủy lực Tellus S2 VX46",specification:"Tellus S2 VX46",oilType:"Dầu thủy lực",oilSpecification:"VX46",materialFamily:"Dầu thủy lực",unit:"lít",source:"maintenance_consumable",demandBasis:"plan_explicit"},
 gearbox:{key:"gearbox-oil",name:"Dầu hộp số Alpha SP 220",specification:"Alpha SP 220",oilType:"Dầu hộp số",oilSpecification:"SP 220",materialFamily:"Dầu hộp số",unit:"lít",source:"maintenance_consumable",demandBasis:"plan_explicit"},
 gearbox320:{key:"gearbox-oil-320",name:"Dầu hộp số Omala S2 GX320",specification:"Omala S2 GX320",oilType:"Dầu hộp số",oilSpecification:"GX320",materialFamily:"Dầu hộp số",unit:"lít",source:"maintenance_consumable",catalogueCode:"23.26.03.031.01",demandBasis:"plan_explicit"},
 engine:{key:"engine-oil",name:"Dầu động cơ CRB Turbomax 15W-40 CI-4",specification:"CRB Turbomax 15W-40 CI-4",oilType:"Dầu động cơ",oilSpecification:"15W-40 CI-4",materialFamily:"Dầu động cơ",unit:"lít",source:"maintenance_consumable",demandBasis:"plan_explicit"},
 gasoline:{key:"gasoline",name:"Xăng",unit:"lít",source:"maintenance_consumable"},
 diesel:{key:"diesel",name:"Dầu diesel",unit:"lít",source:"maintenance_consumable"},
 v2200:{key:"grease-v220-0",name:"Mỡ Gadus S2 V220 0",specification:"Gadus S2 V220 0",oilType:"Mỡ",oilSpecification:"V220 0",materialFamily:"Mỡ bôi trơn",unit:"kg",source:"maintenance_consumable",catalogueCode:"23.26.04.011.01",demandBasis:"plan_explicit"},
 epl2:{key:"grease-epl2",name:"Mỡ Spheerol EPL 2",specification:"Spheerol EPL 2",oilType:"Mỡ",oilSpecification:"EPL 2",materialFamily:"Mỡ bôi trơn",unit:"kg",source:"maintenance_consumable",demandBasis:"plan_explicit"},
 oilFilter:{key:"oil-filter-p554004",name:"Lọc dầu máy P554004",specification:"P554004",materialFamily:"Lọc",unit:"chiếc",source:"warehouse",catalogueCode:"P554004",demandBasis:"plan_explicit"},
 fuelFilter:{key:"fuel-filter-p554620",name:"Lọc nhiên liệu P554620",specification:"P554620",materialFamily:"Lọc",unit:"chiếc",source:"warehouse",catalogueCode:"P554620",demandBasis:"plan_explicit"},
} as const satisfies Record<string,Omit<PlannedMaterial,"quantity">>;

type MaterialKey=keyof typeof materialCatalog;
const material=(key:MaterialKey,quantity:number):PlannedMaterial=>({...materialCatalog[key],quantity});
const row=(group:PlanGroup,equipmentCode:string,maintenanceLevel:MaintenancePlanRow["maintenanceLevel"],materials:PlannedMaterial[],sourceLabel=equipmentCode,operatingReading?:string):MaintenancePlanRow=>({group,equipmentCode,sourceLabel,maintenanceLevel,materials,operatingReading});

const tukanRows:MaintenancePlanRow[]=[
 row("TUKAN","TUKAN05","I - theo tháng",[material("epl2",15)],"Tukan 05","31.047 / 192"),
 row("TUKAN","TUKAN06","I - theo tháng",[material("epl2",15)],"Tukan 06","32.048 / 178"),
 row("TUKAN","TUKAN07","I - theo giờ",[material("epl2",15)],"Tukan 07","715 / 190"),
 row("TUKAN","TUKAN10","II",[material("hydraulic",60),material("gearbox",380),material("epl2",15)],"Tukan 10","1.756 / 175"),
 row("TUKAN","TUKAN11","I - theo tháng",[material("epl2",15)],"Tukan 11","9.988 / 106"),
 row("TUKAN","TUKAN12","I - theo tháng",[material("epl2",15)],"Tukan 12","1.498 / 159"),
];

const qcRows:MaintenancePlanRow[]=[
 row("QC","QC05","I - theo tháng",[material("hydraulic",5),material("epl2",20)],"QC 05","22.549 / 82"),
 row("QC","QC06","I - theo tháng",[material("hydraulic",5),material("epl2",20)],"QC 06","22.857 / 109"),
 row("QC","QC07","I - theo tháng",[material("v2200",3),material("epl2",20)],"QC 07","14.516 / 158"),
 row("QC","QC08","I - theo giờ",[material("hydraulic",10),material("v2200",3),material("epl2",20)],"QC 08","7.502 / 177"),
 row("QC","QC09","I - theo tháng",[material("hydraulic",5),material("v2200",3),material("epl2",20)],"QC 09","5.416 / 172"),
 row("QC","QC10","I - theo tháng",[material("hydraulic",5),material("v2200",3),material("epl2",20)],"QC 10","2.615 / 143"),
 row("QC","QC12","I - theo giờ",[material("v2200",3),material("epl2",20)],"QC 12","9.555 / 144"),
];

const rtgLevels:Record<string,MaintenancePlanRow["maintenanceLevel"]>={
 RTG05:"I - theo tháng",RTG06:"II",RTG10:"II",RTG12:"II",RTG13:"I - theo tháng",RTG14:"I - theo tháng",
 RTG15:"I - theo giờ",RTG16:"I - theo tháng",RTG17:"I - theo giờ",RTG18:"I - theo giờ",RTG19:"I - theo tháng",
 RTG20:"II",RTG21:"I - theo tháng",RTG22:"I - theo tháng",RTG23:"I - theo tháng",RTG24:"I - theo giờ",
 RTG25:"I - theo giờ",RTG26:"I - theo tháng",RTG27:"I - theo tháng",RTG28:"I - theo tháng",RTG29:"I - theo tháng",
 RTG30:"I - theo tháng",RTG31:"I - theo giờ",RTG32:"I - theo tháng",RTG33:"I - theo tháng",RTG34:"I - theo giờ",
};

const rtgRows:MaintenancePlanRow[]=Object.entries(rtgLevels).map(([code,level])=>{
 const materials=[material("epl2",10)];
 if(["RTG06","RTG10","RTG12"].includes(code))materials.unshift(material("engine",35),material("gasoline",3),material("diesel",3),material("oilFilter",1),material("fuelFilter",2));
 if(code==="RTG20")materials.unshift(material("gearbox320",340));
 return row("RTG",code,level,materials,code.replace("RTG","RTG "));
});

const frameRows:MaintenancePlanRow[]=[
 row("KHUNG_CAU","KHUNG57","I - theo tháng",[material("epl2",1)],"Khung cẩu No57"),
 row("KHUNG_CAU","KHUNG60","I - theo tháng",[material("epl2",1)],"Khung cẩu No60"),
 row("KHUNG_CAU","KHUNG64","I - theo tháng",[material("epl2",1)],"Khung cẩu No64"),
 row("KHUNG_CAU","KHUNG66","I - theo tháng",[material("epl2",1)],"Khung cẩu No66"),
 row("KHUNG_CAU","HPP002","I - theo tháng",[material("v2200",2)],"Hpp 002"),
 row("KHUNG_CAU","HPP003","I - theo tháng",[material("v2200",2)],"Hpp 003"),
 row("KHUNG_CAU","HPP004","I - theo tháng",[material("v2200",2)],"Hpp 004"),
 row("KHUNG_CAU","HPP007","I - theo tháng",[material("v2200",3)],"Hpp 007"),
 row("KHUNG_CAU","HPP008","I - theo tháng",[material("v2200",3)],"Hpp 008"),
 row("KHUNG_CAU","HPP009","I - theo tháng",[material("v2200",3)],"Hpp 009"),
 row("KHUNG_CAU","HPP010","I - theo tháng",[material("hydraulic",80),material("v2200",3)],"Hpp 010"),
 row("KHUNG_CAU","HPP042","I - theo tháng",[material("v2200",3)],"Hpp 042"),
 row("KHUNG_CAU","HPP047","I - theo tháng",[material("epl2",1)],"Khung lệch tâm HPP047"),
 row("KHUNG_CAU","OH01","I - theo tháng",[material("epl2",1)],"OH 01"),
 row("KHUNG_CAU","OH02","I - theo tháng",[material("epl2",1)],"OH 02"),
];

// The source plan includes a rag column. It is deliberately not represented here,
// so it cannot enter totals, previews or a later saved requisition.
export const octoberMaintenancePlan:readonly MaintenancePlanRow[]=[...tukanRows,...qcRows,...rtgRows,...frameRows];

// Calendar dates have no time zone. Do not turn them into local Date instants.
export function formatPlannedDay(day:string):string{
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
 return match?`${match[3]}/${match[2]}/${match[1]}`:"";
}

export function normalizeSearch(value:string){
 return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/gi,"d").toUpperCase().replace(/[^A-Z0-9]+/g," ").trim();
}

export function normalizeOilSpecification(value:string){
 return normalizeSearch(value).replace(/(?<=\d)\s+(?=[A-Z])/g,"").replace(/(?<=[A-Z])\s+(?=\d)/g,"");
}

export function planLineId(plan:MaintenancePlanRow,item:PlannedMaterial,period=""){
 const identity=item.catalogueCode||item.key;
 return [period,plan.group,plan.equipmentCode,item.source,normalizeSearch(identity),normalizeOilSpecification(item.specification??item.oilSpecification??""),normalizeSearch(item.unit)].join("|");
}

export function planLines(rows:readonly MaintenancePlanRow[],period=""):PlanLine[]{
 return rows.flatMap(plan=>plan.materials.map(material=>({id:planLineId(plan,material,period),plan,material})));
}

export function snapshotPlanLineIds(snapshot:unknown,period:string):string[]{
 if(!snapshot||typeof snapshot!=="object")return[];
 const rows=(snapshot as {rows?:unknown}).rows;
 if(!Array.isArray(rows))return[];
 return rows.flatMap(value=>{
  if(!value||typeof value!=="object")return[];
  const candidate=value as Partial<MaintenancePlanRow>;
  if(typeof candidate.equipmentCode!=="string"||typeof candidate.group!=="string"||!Array.isArray(candidate.materials))return[];
  return candidate.materials.flatMap(item=>item&&typeof item==="object"&&typeof (item as PlannedMaterial).key==="string"?[planLineId(candidate as MaintenancePlanRow,item as PlannedMaterial,period)]:[]);
 });
}

export function filterPlanLines(rows:readonly MaintenancePlanRow[],filter:MaintenancePlanFilter,period=""):PlanLine[]{
 const groups=filter.groups?.length?new Set(filter.groups):null;
 const equipment=filter.equipmentCodes?.length?new Set(filter.equipmentCodes):null;
 const sources=filter.sources?.length?new Set(filter.sources):null;
 const codes=filter.materialCodes?.length?new Set(filter.materialCodes.map(normalizeSearch)):null;
 const oilType=normalizeSearch(filter.oilType??"");
 const oilSpecification=normalizeOilSpecification(filter.oilSpecification??"");
 const search=normalizeSearch(filter.search??"");
 return planLines(rows,period).filter(({plan,material})=>{
  if(groups&&!groups.has(plan.group))return false;
  if(equipment&&!equipment.has(plan.equipmentCode))return false;
  if(sources&&!sources.has(material.source))return false;
  if(codes&&!codes.has(normalizeSearch(material.catalogueCode??material.key)))return false;
  // Oil type and specification are deliberately checked on this same material.
  if(oilType&&normalizeSearch(material.oilType??"")!==oilType)return false;
  if(oilSpecification&&normalizeOilSpecification(material.oilSpecification??material.specification??"")!==oilSpecification)return false;
  if(search&&!normalizeSearch([plan.equipmentCode,plan.sourceLabel,material.catalogueCode,material.name,material.specification,material.sourceRow,material.sourceText].filter(Boolean).join(" ")).includes(search))return false;
  return true;
 });
}

export function buildMaterialNeeds(rows:readonly MaintenancePlanRow[]):MaterialNeed[]{
 const needs=new Map<string,MaterialNeed>();
 for(const plan of rows)for(const material of plan.materials){
  // A catalogue or norm reference is evidence about an item, not evidence that
  // this monthly plan actually requests it.
  if((material.demandBasis??"plan_explicit")==="catalog_reference")continue;
  const id=[normalizeSearch(material.catalogueCode??material.name),normalizeOilSpecification(material.specification??material.oilSpecification??""),normalizeSearch(material.unit)].join("|");
  const need=needs.get(id)??{id,catalogueCode:material.catalogueCode,name:material.name,specification:material.specification,unit:material.unit,quantity:0,details:[]};
  need.quantity+=material.quantity;
  need.details.push({equipmentCode:plan.equipmentCode,quantity:material.quantity,sourceLabel:plan.sourceLabel});
  needs.set(id,need);
 }
 return [...needs.values()].sort((a,b)=>(a.catalogueCode??a.name).localeCompare(b.catalogueCode??b.name,"vi"));
}

function materialFamily(item:PlannedMaterial){
 return normalizeSearch(item.materialFamily??item.oilType??(item.source==="warehouse"?"Vật tư kho":"Nguyên liệu bảo dưỡng"));
}

export function buildVoucherPreviews(rows:readonly MaintenancePlanRow[],groups:readonly PlanGroup[],grouping:VoucherGrouping,plannedDay?:string,options:VoucherBuildOptions={}):VoucherPreview[]{
 const selected=new Set(groups),buckets=new Map<string,{source:SupplySource;scopeLabel:string;equipmentCodes:Set<string>;equipmentLabels:Map<string,string>;lines:PlannedMaterial[]}>();
 for(const plan of rows){
  if(!selected.has(plan.group))continue;
  for(const [materialIndex,item] of plan.materials.entries()){
   const lineId=planLineId(plan,item,options.period);
   if(options.selectedLineIds&&!options.selectedLineIds.has(lineId))continue;
   const scope=grouping==="date"?`date:${plannedDay??"same-day"}`:grouping==="group"?plan.group:plan.equipmentCode;
   const dateLabel=plannedDay?`Ngày ${plannedDay.slice(8,10)}/${plannedDay.slice(5,7)}/${plannedDay.slice(0,4)}`:"Cùng ngày thực hiện";
   const scopeLabel=grouping==="date"?dateLabel:grouping==="group"?planGroupLabels[plan.group]:plan.sourceLabel;
   const boundaries=options.strictBoundaries?[plan.group,materialFamily(item)]:[];
   if(options.splitByManufacturer)boundaries.push(normalizeSearch(options.equipmentManufacturers?.get(plan.equipmentCode)??"CHƯA ĐỐI CHIẾU HÃNG"));
   const id=[scope,item.source,...boundaries].join(":");
   const bucket=buckets.get(id)??{source:item.source,scopeLabel,equipmentCodes:new Set<string>(),equipmentLabels:new Map<string,string>(),lines:[]};
   bucket.equipmentCodes.add(plan.equipmentCode);
   bucket.equipmentLabels.set(plan.equipmentCode,plan.equipmentName?.trim()||plan.sourceLabel);
   // Giữ riêng từng nhu cầu vật tư theo phương tiện như mẫu BM.08.06.
   // Có thể gom nhiều phương tiện trên một phiếu, nhưng không cộng dồn
   // các dòng trùng tên vật tư của nhiều phương tiện.
   bucket.lines.push({...item,key:lineId||`${plan.equipmentCode}:${item.key}:${materialIndex}`,equipmentCode:plan.equipmentCode,equipmentLabel:plan.sourceLabel});
   buckets.set(id,bucket);
  }
 }
 const sourceOrder:Record<SupplySource,number>={warehouse:0,maintenance_consumable:1};
 return [...buckets.entries()].map(([id,b])=>({id,source:b.source,scopeLabel:b.scopeLabel,equipmentCodes:[...b.equipmentCodes],equipmentLabels:[...b.equipmentLabels.values()],lines:b.lines}))
  .sort((a,b)=>sourceOrder[a.source]-sourceOrder[b.source]||a.scopeLabel.localeCompare(b.scopeLabel,"vi"));
}

function wrappedLines(value:string,characters:number){return Math.max(1,Math.ceil(value.trim().length/characters));}

export function estimateVoucherCopyHeightMm(voucher:VoucherPreview,nameFontPt=10,noteFontPt=9){
 const fixedHeight=91;
 const lineHeight=voucher.lines.reduce((sum,line)=>{
  const nameLines=wrappedLines([line.name,line.specification].filter(Boolean).join(" "),Math.max(18,Math.floor(44*10/nameFontPt)));
  const noteLines=wrappedLines(line.equipmentLabel??line.equipmentCode??"",Math.max(8,Math.floor(15*9/noteFontPt)));
  return sum+Math.max(7.2,Math.max(nameLines,noteLines)*4.1+2.2);
 },0);
 return fixedHeight+lineHeight;
}

export function planVoucherPrint(voucher:VoucherPreview,nameFontPt=10,noteFontPt=9):VoucherPrintPlan{
 const height=estimateVoucherCopyHeightMm(voucher,nameFontPt,noteFontPt);
 const halfPage=132,fullPage=267;
 if(height<=halfPage)return{mode:"two-copies-one-page",physicalPages:1,estimatedCopyHeightMm:height,fillPercent:Math.round(height/halfPage*100),explanation:"Hai liên giống nhau vừa trên một trang A4."};
 if(height<=fullPage)return{mode:"one-copy-per-page",physicalPages:2,estimatedCopyHeightMm:height,fillPercent:Math.round(height/fullPage*100),explanation:"Một liên cần trọn trang A4; khi xuất sẽ có hai trang giống nhau."};
 return{mode:"requires-split",physicalPages:Math.max(4,Math.ceil(height/fullPage)*2),estimatedCopyHeightMm:height,fillPercent:Math.round(height/fullPage*100),explanation:"Nội dung vượt một trang cho mỗi liên; cần chia phiếu thành các phần trước khi xuất."};
}

function estimatedMaterialLineHeightMm(line:PlannedMaterial,nameFontPt=10,noteFontPt=9){
 const nameLines=wrappedLines([line.name,line.specification].filter(Boolean).join(" "),Math.max(18,Math.floor(44*10/nameFontPt)));
 const noteLines=wrappedLines(line.equipmentLabel??line.equipmentCode??"",Math.max(8,Math.floor(15*9/noteFontPt)));
 return Math.max(7.2,Math.max(nameLines,noteLines)*4.1+2.2);
}

export function fitVouchersToA4(vouchers:readonly VoucherPreview[],nameFontPt=10,noteFontPt=9):VoucherPreview[]{
 const lineCapacity=267-91;
 return vouchers.flatMap(voucher=>{
  if(estimateVoucherCopyHeightMm(voucher,nameFontPt,noteFontPt)<=267)return[voucher];
  const byEquipment=new Map<string,PlannedMaterial[]>();
  for(const line of voucher.lines){const code=line.equipmentCode??"CHUA_GHEP";byEquipment.set(code,[...(byEquipment.get(code)??[]),line]);}
  const clusters=[...byEquipment.entries()].flatMap(([equipmentCode,lines])=>{
   const chunks:PlannedMaterial[][]=[];let current:PlannedMaterial[]=[],height=0;
   for(const line of lines){const lineHeight=estimatedMaterialLineHeightMm(line,nameFontPt,noteFontPt);if(current.length&&height+lineHeight>lineCapacity){chunks.push(current);current=[];height=0;}current.push(line);height+=lineHeight;}
   if(current.length)chunks.push(current);
   return chunks.map((chunk,index)=>({equipmentCode,key:`${equipmentCode}:${index}`,lines:chunk,height:chunk.reduce((sum,line)=>sum+estimatedMaterialLineHeightMm(line,nameFontPt,noteFontPt),0)}));
  }).sort((a,b)=>b.height-a.height||a.key.localeCompare(b.key,"vi"));
  const bins:{height:number;clusters:typeof clusters}[]=[];
  for(const cluster of clusters){
   const candidates=bins.map((bin,index)=>({bin,index,after:bin.height+cluster.height})).filter(item=>item.after<=lineCapacity).sort((a,b)=>b.after-a.after||a.index-b.index);
   const target=candidates[0]?.bin;
   if(target){target.clusters.push(cluster);target.height+=cluster.height;}else bins.push({height:cluster.height,clusters:[cluster]});
  }
  const ordered=bins.sort((a,b)=>b.height-a.height||a.clusters[0].key.localeCompare(b.clusters[0].key,"vi"));
  return ordered.map((bin,index)=>{
   const lines=bin.clusters.sort((a,b)=>a.key.localeCompare(b.key,"vi")).flatMap(cluster=>cluster.lines);
   const equipmentCodes=[...new Set(lines.map(line=>line.equipmentCode).filter((value):value is string=>Boolean(value)))];
   return{id:`${voucher.id}:part:${index+1}`,source:voucher.source,scopeLabel:`${voucher.scopeLabel} · phần ${index+1}/${ordered.length}`,equipmentCodes,equipmentLabels:equipmentCodes.map(code=>lines.find(line=>line.equipmentCode===code)?.equipmentLabel??code),lines};
  });
 });
}

export function previewCaseCode(equipmentCode:string,day:string){
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
 return match?`BD-${equipmentCode}-${match[3]}${match[2]}${match[1]}-HHmm-0001`:`BD-${equipmentCode}-chọn-ngày`;
}

