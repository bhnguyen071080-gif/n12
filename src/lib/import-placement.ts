import type {ImportKind} from "./table-import";
export const importPanelLabels:Record<ImportKind,string>={
 equipment:"Nhập phương tiện từ tệp",materials:"Nhập vật tư từ tệp",cargo:"Nhập loại hàng từ tệp",
 hours:"Nhập giờ hoạt động tháng từ tệp",container:"Nhập container tháng từ tệp",other:"Nhập sản lượng hàng khác từ tệp",
};
export function importDestination(kind:ImportKind,workspace?:string){
 const params=new URLSearchParams();if(workspace)params.set("workspace",workspace);
 const path=kind==="equipment"?"/catalog":kind==="materials"?"/materials":"/monthly";
 if(path==="/monthly")params.set("kind",kind==="cargo"?"other":kind);
 params.set("import",kind);
 return path+"?"+params.toString()+"#nhap-tu-tep-"+kind;
}
export function canImportTable(roles:readonly string[],kind:ImportKind){
 return roles.includes("TRUONG_BO_PHAN_KY_THUAT")||(kind==="materials"&&roles.includes("CAN_BO_VAT_TU"))||
 (["hours","container","other"].includes(kind)&&roles.includes("KY_THUAT_VIEN"));
}
