import type {Equipment,Reliability,Cost,Cause} from "./domain";
export type Json=string|number|boolean|null|Json[]|{[key:string]:Json|undefined};
type Table<Row>={Row:Row;Insert:Partial<Row>;Update:Partial<Row>;Relationships:[]};
type View<Row>={Row:Row;Relationships:[]};
export type Workspace={id:string;name:string};
export type History={equipment_id:string;event_key:string;case_code:string|null;order_code:string|null;order_id:string|null;event_type:string;event_at:string;title:string;downtime_hours:number;work_items:Json};
export type Life={id:string;workspace_id:string;equipment_id:string;equipment_code:string;slot_code:string;name:string;component_kind:string;installed_at:string;installed_meter_hours:number;limit_hours:number;warning_hours:number;usage_id:string|null;retired_at:string|null;accumulated_hours:number;used_hours:number;remaining_hours:number;alert_level:string};
export type TechBacklog={workspace_id:string;equipment_id:string;equipment_code:string;equipment_status:string;order_code:string;item_id:string;symptom:string;execution_status:string;material_status:string};
export type ProceduralBacklog={workspace_id:string;equipment_id:string;equipment_code:string;equipment_status:string;order_code:string;item_id:string;symptom:string;material_status:string;requisition_status:string;dossier_status:string;borrowed_quantity_outstanding:number;unsettled_material_lines:number};
type PeriodArgs={p_workspace:string;p_from:string;p_to:string};
type ImportArgs={p_workspace:string;p_rows:Json;p_key:string};
export interface Database {
 public:{
  Tables:{
   workspaces:Table<Workspace>;
   sheet_sources:Table<{id:string;workspace_id:string;name:string;spreadsheet_id:string;tab_name:string;a1_range:string;equipment_aliases:Json;created_by:string;created_at:string}>;
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
   vw_equipment_history:View<History>;
   vw_component_life:View<Life>;
   vw_technical_backlog:View<TechBacklog>;
   vw_procedural_backlog:View<ProceduralBacklog>;
   vw_monthly_activity:View<{workspace_id:string;equipment_id:string;equipment_code:string;month:string;boxes:number|null;operating_hours:number|null;accumulated_hours:number}>;
   vw_other_cargo_monthly:View<{workspace_id:string;equipment_code:string;month:string;cargo_code:string;cargo_name:string;unit:string;quantity:number}>;
   vw_maintenance_due:View<{workspace_id:string;equipment_code:string;name:string;accumulated_hours:number;due_hours:number|null;due_date:string|null;alert_level:string}>;
  };
  Functions:{
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
