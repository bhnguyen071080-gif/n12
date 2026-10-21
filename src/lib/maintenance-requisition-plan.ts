export type PlanGroup="TUKAN"|"QC"|"RTG"|"KHUNG_CAU";
export type SupplySource="warehouse"|"maintenance_consumable";
export type VoucherGrouping="equipment"|"group";

export type PlannedMaterial={
 key:string;
 name:string;
 unit:string;
 quantity:number;
 source:SupplySource;
 catalogueCode?:string;
};

export type MaintenancePlanRow={
 sourceLabel:string;
 equipmentCode:string;
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
 lines:PlannedMaterial[];
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

const materialCatalog={
 hydraulic:{key:"hydraulic-oil",name:"Dầu thủy lực",unit:"lít",source:"maintenance_consumable"},
 gearbox:{key:"gearbox-oil",name:"Dầu hộp số",unit:"lít",source:"maintenance_consumable"},
 engine:{key:"engine-oil",name:"Dầu máy",unit:"lít",source:"maintenance_consumable"},
 gasoline:{key:"gasoline",name:"Xăng",unit:"lít",source:"maintenance_consumable"},
 diesel:{key:"diesel",name:"Dầu diesel",unit:"lít",source:"maintenance_consumable"},
 v2200:{key:"grease-v220-0",name:"Mỡ V220-0",unit:"kg",source:"maintenance_consumable"},
 epl2:{key:"grease-epl2",name:"Mỡ EPL2",unit:"kg",source:"maintenance_consumable"},
 oilFilter:{key:"oil-filter-p554004",name:"Lọc dầu máy",unit:"chiếc",source:"warehouse",catalogueCode:"P554004"},
 fuelFilter:{key:"fuel-filter-p554620",name:"Lọc nhiên liệu",unit:"chiếc",source:"warehouse",catalogueCode:"P554620"},
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
 if(code==="RTG20")materials.unshift(material("gearbox",340));
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

export function buildVoucherPreviews(rows:readonly MaintenancePlanRow[],groups:readonly PlanGroup[],grouping:VoucherGrouping):VoucherPreview[]{
 const selected=new Set(groups),buckets=new Map<string,{source:SupplySource;scopeLabel:string;equipmentCodes:Set<string>;lines:Map<string,PlannedMaterial>}>();
 for(const plan of rows){
  if(!selected.has(plan.group))continue;
  for(const item of plan.materials){
   const scope=grouping==="group"?plan.group:plan.equipmentCode;
   const scopeLabel=grouping==="group"?planGroupLabels[plan.group]:plan.sourceLabel;
   const id=`${scope}:${item.source}`;
   const bucket=buckets.get(id)??{source:item.source,scopeLabel,equipmentCodes:new Set<string>(),lines:new Map<string,PlannedMaterial>()};
   bucket.equipmentCodes.add(plan.equipmentCode);
   const lineKey=`${item.key}:${item.unit}:${item.catalogueCode??""}`;
   const prior=bucket.lines.get(lineKey);
   bucket.lines.set(lineKey,prior?{...prior,quantity:prior.quantity+item.quantity}:{...item});
   buckets.set(id,bucket);
  }
 }
 const sourceOrder:Record<SupplySource,number>={warehouse:0,maintenance_consumable:1};
 return [...buckets.entries()].map(([id,b])=>({id,source:b.source,scopeLabel:b.scopeLabel,equipmentCodes:[...b.equipmentCodes],lines:[...b.lines.values()]}))
  .sort((a,b)=>sourceOrder[a.source]-sourceOrder[b.source]||a.scopeLabel.localeCompare(b.scopeLabel,"vi"));
}

export function previewCaseCode(equipmentCode:string,day:string){
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
 return match?`BD-${equipmentCode}-${match[3]}${match[2]}${match[1]}-HHmm-0001`:`BD-${equipmentCode}-chọn-ngày`;
}

