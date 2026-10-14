import {TableImporter} from "./table-importer";
import {importPanelLabels} from "@/lib/import-placement";
import type {ImportKind} from "@/lib/table-import";
export function TableImportPanel({workspace,kind,canImport,defaultOpen=false}:{workspace:string;kind:ImportKind;canImport:boolean;defaultOpen?:boolean}){
 return <details className="panel table-import-panel" id={"nhap-tu-tep-"+kind} open={defaultOpen}>
  <summary>{importPanelLabels[kind]}<span className="muted">Excel / CSV · kiểm tra trước khi lưu</span></summary>
  <TableImporter key={workspace+kind} workspace={workspace} kind={kind} canImport={canImport} embedded/>
 </details>;
}
