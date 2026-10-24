import {TableImporter} from "./table-importer";
import {importPanelLabels} from "@/lib/import-placement";
import type {ImportKind} from "@/lib/table-import";
export function TableImportPanel({workspace,kind,canImport,defaultOpen=false}:{workspace:string;kind:ImportKind;canImport:boolean;defaultOpen?:boolean}){
 return <section className="panel table-import-panel" id={"nhap-tu-tep-"+kind}>
  <h2>{importPanelLabels[kind]}</h2>
  <TableImporter key={workspace+kind} workspace={workspace} kind={kind} canImport={canImport} embedded/>
 </section>;
}
