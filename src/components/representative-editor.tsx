"use client";
import {useId,useState} from "react";
import {blankRepresentative,parseRepresentatives,serializeRepresentatives,representativeLabel,representativeTitles,type Representative} from "../lib/document-people";
type Group={unit:string;members:string};
type EditableGroup={key:number;unit:string;people:{key:number;person:Representative}[]};
export function RepresentativeEditor({initial,onChange}:{initial:Group[];onChange:(value:Group[])=>void}){
 const listId=useId();
 const [groups,setGroups]=useState<EditableGroup[]>(()=>initial.map((group,i)=>({key:i,unit:group.unit,people:parseRepresentatives(group.members).map((person,j)=>({key:j,person}))})));
 function commit(next:EditableGroup[]){setGroups(next);onChange(next.map(group=>({unit:group.unit,members:serializeRepresentatives(group.people.map(row=>row.person))})));}
 function updateGroup(key:number,change:(group:EditableGroup)=>EditableGroup){commit(groups.map(group=>group.key===key?change(group):group));}
 return <div className="representative-editor space-y-4">
 <datalist id={listId}>{representativeTitles.map(title=><option key={title} value={title}/>)}</datalist>
 <p>Chọn chức danh gợi ý hoặc gõ lại. Người được chọn đại diện ký sẽ có họ tên dưới phần ký; không tạo chữ ký thay người đó.</p>
 {groups.map((group,groupIndex)=><section className="document-participant" key={group.key}>
 <label>Đơn vị đại diện {groupIndex+1}<input maxLength={200} value={group.unit} onChange={e=>updateGroup(group.key,g=>({...g,unit:e.target.value}))}/></label>
 <div className="representative-table-scroll"><table className="representative-table"><colgroup>{[6,12,34,39,9].map((width,i)=><col key={i} style={{width:width+"%"}}/>)}</colgroup><thead><tr><th scope="col">STT</th><th scope="col">Ông / Bà</th><th scope="col">Họ và tên</th><th scope="col">Chức danh</th><th scope="col">Thao tác</th></tr></thead><tbody>
 {group.people.map((row,index)=><tr key={row.key}><th scope="row">{index+1}</th><td><select aria-label={`Xưng hô người ${index+1}, đơn vị ${groupIndex+1}`} value={row.person.salutation} onChange={e=>updateGroup(group.key,g=>({...g,people:g.people.map(p=>p.key===row.key?{...p,person:{...p.person,salutation:e.target.value as Representative["salutation"]}}:p)}))}><option>Ông</option><option>Bà</option><option value="">Không ghi</option></select></td>
 <td><input aria-label={`Họ tên người ${index+1}, đơn vị ${groupIndex+1}`} maxLength={100} value={row.person.name} required={!!row.person.title} onChange={e=>updateGroup(group.key,g=>({...g,people:g.people.map(p=>p.key===row.key?{...p,person:{...p.person,name:e.target.value}}:p)}))}/></td>
 <td><input aria-label={`Chức danh người ${index+1}, đơn vị ${groupIndex+1}`} list={listId} maxLength={160} value={row.person.title} onChange={e=>updateGroup(group.key,g=>({...g,people:g.people.map(p=>p.key===row.key?{...p,person:{...p.person,title:e.target.value}}:p)}))}/></td>
 <td><button type="button" className="button-secondary" aria-label={`Bỏ người ${index+1}, đơn vị ${groupIndex+1}`} onClick={()=>updateGroup(group.key,g=>({...g,people:g.people.filter(p=>p.key!==row.key)}))}>Bỏ</button></td></tr>)}
 </tbody></table></div>
 <div className="representative-actions"><button type="button" className="button-secondary" disabled={group.people.length>=10} onClick={()=>updateGroup(group.key,g=>({...g,people:[...g.people,{key:Math.max(-1,...g.people.map(p=>p.key))+1,person:blankRepresentative()}]}))}>Thêm người tham gia</button>
 <label>Người đại diện ký — đơn vị {groupIndex+1}<select value={group.people.find(row=>row.person.signs)?.key??""} onChange={e=>updateGroup(group.key,g=>({...g,people:g.people.map(row=>({...row,person:{...row.person,signs:e.target.value!==""&&row.key===Number(e.target.value)}}))}))}><option value="">Chưa chọn</option>{group.people.map(row=><option key={row.key} value={row.key}>{representativeLabel(row.person)||"Chưa nhập họ tên"}</option>)}</select></label>
 <button type="button" className="button-secondary" onClick={()=>commit(groups.filter(g=>g.key!==group.key))}>Bỏ đơn vị đại diện {groupIndex+1}</button></div>
 {serializeRepresentatives(group.people.map(row=>row.person)).length>1000?<p role="alert">Thành phần đơn vị này vượt 1.000 ký tự. Rút gọn chức danh trước khi lưu.</p>:null}
 </section>)}
 <button type="button" className="button-secondary" disabled={groups.length>=3} onClick={()=>commit([...groups,{key:Math.max(-1,...groups.map(g=>g.key))+1,unit:"",people:[]}])}>Thêm đơn vị đại diện</button>
 </div>;
}
