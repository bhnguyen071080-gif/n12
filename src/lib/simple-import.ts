import type {ImportPlan} from "./table-import";
export function newRowsOnly(plan:ImportPlan[]){
 const changed=plan.filter(p=>p.action==="update");
 if(changed.length)throw Error(`Có ${changed.length} dòng trùng mã nhưng khác thông tin. Chưa nhập dòng nào; hãy sửa trực tiếp các mã đã có.`);
 return {rows:plan.filter(p=>p.action==="add").map(p=>({row:p.row,expected:p.expected})),unchanged:plan.filter(p=>p.action==="same").length};
}
