import type {DocumentPayload} from "../lib/documents";
import {parseRepresentatives,representativeLabel} from "../lib/document-people";
export function ConditionMinutesPaper({payload:d}:{payload:DocumentPayload}){
 const groups=d.participants.filter(group=>group.unit.trim()).map(group=>({...group,people:parseRepresentatives(group.members)}));
 const number=(value:number)=>new Intl.NumberFormat("vi-VN",{maximumFractionDigits:3}).format(value);
 return <div className="document-print-area"><article className="condition-paper" aria-label="Bản in biên bản Times New Roman 13">
 <div className="paper-code">Mẫu: {d.form_code||"BM.12.06"}</div>
 <header className="paper-letterhead"><div><strong className="paper-organization">{d.company}</strong><br/><strong className="paper-underlined">{d.department}</strong><p>Số: {d.document_number||"................"}</p></div><div><strong className="paper-national-heading">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br/><strong className="paper-underlined">Độc lập - Tự do - Hạnh phúc</strong></div></header>
 <div className="paper-title"><h2>BIÊN BẢN KIỂM TRA</h2><h3>XÁC ĐỊNH TÌNH TRẠNG KỸ THUẬT</h3><p><strong>PTTB/CCXD: {d.equipment_label}</strong></p></div>
 <p>Hôm nay, vào hồi {d.document_at.slice(11,13)} giờ {d.document_at.slice(14,16)} phút, ngày {d.document_at.slice(8,10)} tháng {d.document_at.slice(5,7)} năm {d.document_at.slice(0,4)}, tại {d.location}, chúng tôi gồm:</p>
 {groups.map((group,i)=><section className="paper-party" key={i}><h3>{["I","II","III"][i]}. Đại diện {group.unit}</h3>
 <table className="paper-people" aria-label={`Thành phần đại diện ${group.unit}`}><colgroup><col style={{width:"7%"}}/><col style={{width:"48%"}}/><col style={{width:"45%"}}/></colgroup><tbody>{group.people.map((person,j)=><tr key={j}><td>{j+1}.</td><td>{representativeLabel(person)}</td><td>{person.title}</td></tr>)}</tbody></table>
 </section>)}
 <p className="paper-inspection-intro">Cùng nhau kiểm tra, xác định tình trạng kỹ thuật {d.equipment_label} như sau:</p>
 {d.lines.length?<table className="paper-inspection"><colgroup>{[7,21,8,9,9,9,27,10].map((width,i)=><col key={i} style={{width:width+"%"}}/>)}</colgroup><thead><tr><th rowSpan={2} scope="col">STT</th><th rowSpan={2} scope="col">Tên phương tiện thiết bị, vật tư</th><th rowSpan={2} scope="col">ĐVT</th><th rowSpan={2} scope="col">Số lượng</th><th colSpan={2} scope="colgroup">Định mức sử dụng</th><th rowSpan={2} scope="col">Tình trạng kỹ thuật</th><th rowSpan={2} scope="col">Ghi chú</th></tr><tr><th scope="col">Định mức</th><th scope="col">Thực hiện</th></tr></thead><tbody>{d.lines.map((line,i)=><tr key={i}><td>{i+1}</td><td>{line.name}{line.specification?<><br/>{line.specification}</>:null}</td><td>{line.unit}</td><td>{number(line.requested)}</td><td>{line.limit_text}</td><td>{line.used_text}</td><td>{line.condition}</td><td>{line.notes}</td></tr>)}</tbody></table>:null}
 <section className="paper-conclusion"><h3>Kết luận</h3><p><strong>Nguyên nhân: </strong>{d.cause||"................................"}</p><p><strong>Đề xuất biện pháp khắc phục: </strong>{d.solution||"................................"}</p></section>
 {groups.length?<div className="paper-signature-block"><div className={`paper-signatures paper-signatures-${groups.length}`}>{groups.map((group,i)=>{const signer=group.people.find(person=>person.signs);return <section key={i}><strong className="paper-signature-heading">ĐẠI DIỆN {group.unit.toLocaleUpperCase("vi")}</strong><p>(Ký, ghi rõ họ tên)</p><div className="paper-signature-space"/><strong className="paper-signer-name">{signer?.name||""}</strong></section>;})}</div></div>:null}
 </article></div>;
}
