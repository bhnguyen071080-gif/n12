import type {Equipment,Reliability,Cost,Cause} from "./domain";
import type {WorkItem,MaterialHours} from "./followup";
import type {CaseDocument} from "./documents";
import type {SavedRequisitionPlan} from "./saved-requisition-plan";
export type Json=string|number|boolean|null|Json[]|{[key:string]:Json|undefined};
type Table<Row>={Row:Row;Insert:Partial<Row>;Update:Partial<Row>;Relationships:[]};
type View<Row>={Row:Row;Relationships:[]};
export type Workspace={id:string;name:string};
export type History={equipment_id:string;event_key:string;case_code:string|null;order_code:string|null;order_id:string|null;event_type:string;event_at:string;title:string;downtime_hours:number;work_items:Json};
export type Life={id:string;workspace_id:string;equipment_id:string;equipment_code:string;slot_code:string;name:string;component_kind:string;installed_at:string;installed_meter_hours:number;limit_hours:number;warning_hours:number;usage_id:string|null;retired_at:string|null;accumulated_hours:number|null;used_hours:number|null;remaining_hours:number|null;alert_level:string};
export type TechBacklog={workspace_id:string;equipment_id:string;equipment_code:string;equipment_status:string;order_code:string;item_id:string;symptom:string;execution_status:string;material_status:string};
export type ProceduralBacklog={workspace_id:string;equipment_id:string;equipment_code:string;equipment_status:string;order_code:string;item_id:string;symptom:string;material_status:string;requisition_status:string;dossier_status:string;borrowed_quantity_outstanding:number;unsettled_material_lines:number};
type PeriodArgs={p_workspace:string;p_from:string;p_to:string};
type ImportArgs={p_workspace:string;p_rows:Json;p_key:string};
export interface Database {
 public:{
  Tables:{
   case_documents:Table<CaseDocument>;
   workspaces:Table<Workspace>;
   work_cases:Table<{id:string;equipment_id:string;kind:"repair"|"maintenance"|"cleaning"|"inspection";code:string;summary:string;created_at:string;tracking_only:boolean;actual_started_at:string}>;
   repair_orders:Table<{id:string;equipment_id:string;case_id:string|null;code:string;title:string;closed_at:string|null;cancelled_at:string|null}>;
   repair_work_items:Table<WorkItem>;
   repair_material_usages:Table<{id:string;repair_work_item_id:string;material_id:string;quantity:number;supply_state:"planned"|"borrowed"|"issued";is_installed:boolean;installation_position:string;installed_at:string|null}>;
   materials:Table<{id:string;workspace_id:string;code:string;name:string;unit:string;equipment_category:string|null;service_limit_hours:number|null;service_warning_hours:number}>;
   case_material_followups:Table<{case_id:string;return_status:"pending"|"completed";completed_at:string|null;notes:string;version_no:number}>;
   maintenance_requisition_runs:Table<SavedRequisitionPlan&{document_day:string;voucher_kind:"planned"|"supplemental";supplement_note:string|null;fingerprint:string;source_filename:string|null;source_sha256:string|null}>;
   contractor_materials:Table<{id:string;workspace_id:string;equipment_id:string;material_name:string;unit:string;quantity:number;contractor_name:string;signed_on:string;warranty_months:number;warranty_ends_on:string;quality_status:string;quality_checked_on:string|null;quality_note:string;notes:string;request_key:string;created_by:string;updated_by:string;created_at:string;updated_at:string}>;
   sheet_sources:Table<{id:string;workspace_id:string;name:string;spreadsheet_id:string;tab_name:string;a1_range:string;equipment_aliases:Json;source_kind:"container"|"hours";start_month:string|null;created_by:string;created_at:string}>;
   sheet_sync_runs:Table<{id:string;source_id:string;workspace_id:string;request_key:string;actor_id:string;fingerprint:string;accepted_rows:Json;row_count:number;created_at:string}>;
   equipment:Table<Equipment>;
   workspace_memberships:Table<{workspace_id:string;user_id:string;role:string;active:boolean}>;
   monthly_operating_hours:Table<{id:string;equipment_id:string;month:string;operating_hours:number}>;
   monthly_production:Table<{id:string;equipment_id:string;month:string;boxes:number}>;
   monthly_other_cargo:Table<{id:string;equipment_id:string;cargo_type_id:string;month:string;quantity:number}>;
   cargo_types:Table<{id:string;workspace_id:string;code:string;name:string;unit:string}>;
   failure_incidents:Table<{id:string;equipment_id:string;repair_order_id:string;occurred_at:string;restored_at:string|null;confirmed:boolean;primary_cause_group:Cause["cause"];created_by:string}>;
   equipment_life_items:Table<{id:string;equipment_id:string;slot_code:string;name:string;component_kind:string;installed_at:string;installed_meter_hours:number;limit_hours:number;warning_hours:number;usage_id:string|null;retired_at:string|null}>;
   equipment_teams:Table<{id:string;workspace_id:string;code:string;name:string}>;
  };
  Views:{
   vw_case_followup_backlog:View<{workspace_id:string;equipment_code:string;case_id:string;case_code:string;summary:string;return_status:string;completed_at:string|null;version_no:number;material_lines:number}>;
   vw_equipment_history:View<History>;
   vw_component_life:View<Life>;
   vw_technical_backlog:View<TechBacklog>;
   vw_procedural_backlog:View<ProceduralBacklog>;
   vw_monthly_activity:View<{workspace_id:string;equipment_id:string;equipment_code:string;month:string;boxes:number|null;operating_hours:number|null;accumulated_hours:number|null}>;
   vw_other_cargo_monthly:View<{workspace_id:string;equipment_code:string;month:string;cargo_code:string;cargo_name:string;unit:string;quantity:number}>;
   vw_maintenance_due:View<{workspace_id:string;equipment_code:string;name:string;accumulated_hours:number|null;due_hours:number|null;due_date:string|null;alert_level:string}>;
  };
  Functions:{
   preview_import_table:{Args:{p_workspace:string;p_kind:string;p_rows:Json};Returns:Json};
   import_table_batch:{Args:{p_workspace:string;p_kind:string;p_mode:string;p_plan:Json;p_key:string};Returns:number};
   save_equipment_catalog:{Args:{p_workspace:string;p_id:string|null;p_version:number|null;p_key:string;p_code:string;p_name:string;p_category:string;p_base_status:string;p_serial:string|null;p_year:number|null;p_notes:string;p_aliases:string[]};Returns:string};
   confirm_operating_baseline:{Args:{p_equipment:string;p_hours:number;p_start:string;p_key:string};Returns:string};
   get_case_document_source:{Args:{p_case:string;p_kind:string};Returns:Json};
   save_case_document:{Args:{p_case:string;p_kind:string;p_payload:Json;p_source_hash:string;p_key:string};Returns:string};
   claim_document_drive:{Args:{p_document:string;p_file_id:string};Returns:Json};
   finish_document_drive:{Args:{p_document:string;p_lease:string;p_sha256:string;p_actor:string};Returns:undefined};
   release_document_drive:{Args:{p_document:string;p_lease:string};Returns:undefined};
   report_operating_hours:{Args:{p_equipment:string;p_from:string;p_to:string};Returns:{month:string;operating_hours:number|null}[]};
   report_material_hours:{Args:{p_equipment:string;p_to:string};Returns:MaterialHours[]};
   report_workspace_material_hours:{Args:{p_workspace:string;p_to:string};Returns:(MaterialHours&{equipment_id:string;equipment_code:string})[]};
   create_tracking_case:{Args:{p_equipment:string;p_kind:"repair"|"maintenance"|"cleaning"|"inspection";p_day:string;p_summary:string;p_key:string};Returns:string};
   save_tracking_item:{Args:{p_order:string;p_item:string|null;p_version:number|null;p_data:Json;p_key:string};Returns:string};
   save_tracking_item_v2:{Args:{p_order:string;p_item:string|null;p_version:number|null;p_data:Json;p_minutes:number;p_key:string};Returns:string};
   report_work_hours:{Args:PeriodArgs;Returns:{equipment_id:string;equipment_code:string;repair_hours:number;maintenance_hours:number;replacement_hours:number;repair_events:number;maintenance_events:number}[]};
   add_tracking_material:{Args:{p_item:string;p_material:string;p_quantity:number;p_supply:string;p_installed:boolean;p_position:string;p_key:string};Returns:string};
   update_tracking_material:{Args:{p_usage:string;p_supply:string;p_installed:boolean};Returns:undefined};
   set_material_return:{Args:{p_case:string;p_status:string;p_completed:string|null;p_version:number;p_notes:string};Returns:undefined};
   save_maintenance_requisition_v2:{Args:{p_workspace:string;p_day:string;p_grouping:string;p_rows:Json;p_print:Json;p_source_filename:string;p_source_sha256:string;p_key:string};Returns:string};
   save_maintenance_requisition_v3:{Args:{p_workspace:string;p_planned_day:string;p_document_day:string;p_voucher_kind:"planned"|"supplemental";p_supplement_note:string|null;p_grouping:string;p_rows:Json;p_print:Json;p_source_filename:string;p_source_sha256:string;p_key:string};Returns:string};
   sync_hours_source:{Args:{p_source:string;p_rows:Json;p_key:string};Returns:number};
   sync_container_source:{Args:{p_source:string;p_rows:Json;p_key:string};Returns:number};
   report_reliability:{Args:PeriodArgs;Returns:Reliability[]};
   report_material_costs:{Args:PeriodArgs;Returns:Cost[]};
   report_failure_causes:{Args:PeriodArgs;Returns:Cause[]};
   import_operating_months:{Args:ImportArgs;Returns:number};
   import_container_months:{Args:ImportArgs;Returns:number};
   import_other_cargo_months:{Args:ImportArgs;Returns:number};
   report_equipment_fault:{Args:{p_equipment:string;p_when:string;p_symptom:string;p_stopped:boolean;p_key:string};Returns:string};
   submit_quick_inspection:{Args:{p_equipment:string;p_when:string;p_notes:string;p_abnormal:boolean;p_key:string};Returns:string};
   convert_inspection_to_repair:{Args:{p_case:string};Returns:string};
  };
  Enums:Record<string,never>;CompositeTypes:Record<string,never>;
 };
}


