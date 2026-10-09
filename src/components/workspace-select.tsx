import type {Workspace} from "@/lib/database";
export function WorkspaceSelect({workspaces,selected}:{workspaces:Workspace[];selected?:string}){
 return <form method="get" className="flex items-end gap-3"><label>Không gian dữ liệu / chi nhánh<select name="workspace" defaultValue={selected}>{workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label><button>Chọn</button></form>;
}
