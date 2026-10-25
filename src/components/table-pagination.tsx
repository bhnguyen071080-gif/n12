"use client";

export function TablePagination({page,total,pageSize,onChange}:{page:number;total:number;pageSize:number;onChange:(page:number)=>void}){
 const pages=Math.max(1,Math.ceil(total/pageSize));
 if(pages===1)return null;
 const from=(page-1)*pageSize+1,to=Math.min(page*pageSize,total);
 return <nav className="table-pagination no-print" aria-label="Phân trang bảng">
  <span>Hiển thị {from}–{to} / {total}</span>
  <div><button type="button" className="button-secondary" disabled={page<=1} onClick={()=>onChange(page-1)}>Trang trước</button><strong>{page} / {pages}</strong><button type="button" className="button-secondary" disabled={page>=pages} onClick={()=>onChange(page+1)}>Trang sau</button></div>
 </nav>;
}

