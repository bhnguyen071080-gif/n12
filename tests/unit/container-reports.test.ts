import test from "node:test";
import assert from "node:assert/strict";
import {annualByEquipment,annualByGroup,groupFromCategory,type ContainerReportRow} from "../../src/lib/container-reports";

const row=(group:"TK"|"QC"|"RTG",month:string,boxes:number,equipment="e1"):ContainerReportRow=>({id:`${equipment}-${month}`,workspace_id:"w",equipment_id:equipment,equipment_code:equipment.toUpperCase(),equipment_name:`Máy ${equipment}`,equipment_group:group,month,boxes,status:"summarized",notes:"",compiler_name:"u",created_at:"",updated_at:"",version_no:1,anomaly_acknowledged:false,cancelled_at:null,cancel_reason:null,admin_action_reason:null,anomaly_kind:null});
test("TUKAN is displayed as TK and unsupported categories are excluded",()=>{assert.equal(groupFromCategory("TUKAN"),"TK");assert.equal(groupFromCategory("FORKLIFT"),null);});
test("annual report sums twelve monthly columns and excludes cancelled records",()=>{const cancelled={...row("QC","2026-03-01",99),id:"cancelled",cancelled_at:"2026-04-01"};const result=annualByEquipment([row("QC","2026-01-01",10),row("QC","2026-02-01",20),cancelled]);assert.equal(result[0].months[0],10);assert.equal(result[0].months[1],20);assert.equal(result[0].months[2],0);assert.equal(result[0].total,30);});
test("group annual report keeps all three groups for direct comparison",()=>{const result=annualByGroup([row("TK","2026-01-01",5,"tk1"),row("RTG","2026-01-01",7,"r1")]);assert.deepEqual(result.map(item=>item.group),["TK","QC","RTG"]);assert.deepEqual(result.map(item=>item.total),[5,0,7]);});
