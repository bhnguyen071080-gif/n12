export const containerGroups=["TK","QC","RTG"] as const;
export type ContainerGroup=typeof containerGroups[number];
export type ContainerReportStatus="draft"|"summarized"|"checked"|"locked";
export type ContainerEquipment={id:string;code:string;name:string;category:string};
export type ContainerReportRow={
 id:string;workspace_id:string;equipment_id:string;equipment_code:string;equipment_name:string;equipment_group:ContainerGroup;
 month:string;boxes:number;status:ContainerReportStatus;notes:string;compiler_name:string;created_at:string;updated_at:string;
 version_no:number;anomaly_acknowledged:boolean;cancelled_at:string|null;cancel_reason:string|null;admin_action_reason:string|null;
 anomaly_kind:"zero_after_positive"|"change_over_50_pct"|null;
};
export const containerStatusLabels:Record<ContainerReportStatus,string>={draft:"Nháp",summarized:"Đã tổng hợp",checked:"Đã kiểm tra",locked:"Đã khóa"};
export const anomalyLabels:Record<NonNullable<ContainerReportRow["anomaly_kind"]>,string>={zero_after_positive:"Bằng 0 sau tháng có sản lượng",change_over_50_pct:"Thay đổi trên 50% so với bình quân 3 tháng trước"};
export function groupFromCategory(category:string):ContainerGroup|null{return category==="TUKAN"?"TK":category==="QC"?"QC":category==="RTG"?"RTG":null;}
export function monthNumber(month:string){return Number(month.slice(5,7));}
export function monthText(month:string){const [y,m]=month.slice(0,7).split("-");return `${m}/${y}`;}
export function annualByEquipment(rows:ContainerReportRow[]){
 const map=new Map<string,{equipmentCode:string;equipmentName:string;group:ContainerGroup;months:number[]}>();
 for(const row of rows){if(row.cancelled_at)continue;const value=map.get(row.equipment_id)??{equipmentCode:row.equipment_code,equipmentName:row.equipment_name,group:row.equipment_group,months:Array(12).fill(0)};value.months[monthNumber(row.month)-1]+=row.boxes;map.set(row.equipment_id,value);}
 return [...map.values()].map(row=>({...row,total:row.months.reduce((a,b)=>a+b,0)})).sort((a,b)=>a.group.localeCompare(b.group)||a.equipmentCode.localeCompare(b.equipmentCode,"vi"));
}
export function annualByGroup(rows:ContainerReportRow[]){
 const map=new Map<ContainerGroup,number[]>(containerGroups.map(group=>[group,Array(12).fill(0)]));
 for(const row of rows)if(!row.cancelled_at)map.get(row.equipment_group)![monthNumber(row.month)-1]+=row.boxes;
 return containerGroups.map(group=>{const months=map.get(group)!;return {group,months,total:months.reduce((a,b)=>a+b,0)};});
}
