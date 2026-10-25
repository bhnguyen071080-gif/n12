import {formatNumber} from "@/lib/domain";
import {buildMonthlyMatrix,monthKeys,type MonthlyActivity,type MonthlyEquipment} from "@/lib/monthly-overview";

function Bars({values,color,suffix}:{values:{label:string;value:number}[];color:string;suffix:string}){
 const max=Math.max(1,...values.map(item=>item.value));
 return <div className="monthly-bars">{values.map(item=><div key={item.label} className="monthly-bar-item"><span>{item.label.slice(5,7)}/{item.label.slice(2,4)}</span><div><i style={{height:`${Math.max(2,item.value/max*100)}%`,background:color}} title={`${formatNumber(item.value)} ${suffix}`}/></div><small>{formatNumber(item.value,0)}</small></div>)}</div>;
}

export function MonthlyOverview({equipment,activity,from,to}:{equipment:MonthlyEquipment[];activity:MonthlyActivity[];from:string;to:string}){
 const months=monthKeys(from,to),matrix=buildMonthlyMatrix(equipment,activity,months),totalHours=matrix.totals.reduce((sum,item)=>sum+item.hours,0),totalBoxes=matrix.totals.reduce((sum,item)=>sum+item.boxes,0),missing=matrix.totals.reduce((sum,item)=>sum+item.missing,0);
 return <section className="panel monthly-overview"><div className="section-heading"><div><p className="eyebrow">BÁO CÁO ĐIỀU HÀNH</p><h2>Tất cả phương tiện theo tháng và năm</h2></div><span className="count-chip">{equipment.length} phương tiện · {months.length} tháng</span></div>
  <div className="monthly-kpis"><article><span>Tổng giờ</span><strong>{formatNumber(totalHours)} h</strong></article><article><span>Tổng container</span><strong>{formatNumber(totalBoxes,0)}</strong></article><article><span>Ô giờ còn thiếu</span><strong>{missing}</strong></article><article><span>Tỷ lệ đủ dữ liệu</span><strong>{equipment.length*months.length?formatNumber((1-missing/(equipment.length*months.length))*100,1):0}%</strong></article></div>
  <div className="monthly-chart-grid"><article><h3>Xu hướng giờ hoạt động</h3><Bars values={matrix.totals.map(item=>({label:item.month,value:item.hours}))} color="#176b8f" suffix="h"/></article><article><h3>Xu hướng container</h3><Bars values={matrix.totals.map(item=>({label:item.month,value:item.boxes}))} color="#d8792b" suffix="chiếc"/></article></div>
  <h3>Tổng hợp theo năm</h3><div className="overflow-x-auto"><table className="compact-table"><thead><tr><th>Năm</th><th>Giờ hoạt động</th><th>Container</th><th>Ô giờ thiếu</th></tr></thead><tbody>{matrix.years.map(row=><tr key={row.year}><td><strong>{row.year}</strong></td><td>{formatNumber(row.hours)} h</td><td>{formatNumber(row.boxes,0)}</td><td>{row.missing}</td></tr>)}</tbody></table></div>
  <h3>Ma trận phương tiện × tháng</h3><p className="muted">Mỗi ô hiển thị giờ hoạt động; số container nằm ở dòng nhỏ. Dấu “—” là chưa có dữ liệu, không tự coi là 0.</p><div className="overflow-x-auto monthly-matrix-scroll"><table className="compact-table monthly-matrix"><thead><tr><th>Nhóm</th><th>Phương tiện</th>{months.map(month=><th key={month}>{month.slice(5,7)}/{month.slice(2,4)}</th>)}</tr></thead><tbody>{matrix.rows.map(row=><tr key={row.equipment.id}><td>{row.equipment.category}</td><td><strong>{row.equipment.code}</strong></td>{row.cells.map((cell,index)=><td key={months[index]} className={cell.hours===null?"monthly-missing":""}>{cell.hours===null?"—":formatNumber(cell.hours)}<small>{cell.boxes===null?"":`${formatNumber(cell.boxes,0)} cont`}</small></td>)}</tr>)}</tbody></table></div>
 </section>;
}

