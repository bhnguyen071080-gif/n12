"use client";
import {useId} from "react";

type TablePaginationProps={
 page:number;
 total:number;
 pageSize:number;
 onChange:(page:number)=>void;
 pageSizes?:readonly number[];
 onPageSizeChange?:(pageSize:number)=>void;
};
const defaultPageSizes=[10,25,50,100] as const;

export function TablePagination({page,total,pageSize,onChange,pageSizes=defaultPageSizes,onPageSizeChange}:TablePaginationProps){
 const pageSizeId=useId();
 const pages=Math.max(1,Math.ceil(total/pageSize));
 if(total===0)return null;
 const safePage=Math.min(Math.max(page,1),pages),from=(safePage-1)*pageSize+1,to=Math.min(safePage*pageSize,total);
 return <nav className="table-pagination no-print" aria-label="Phân trang bảng">
  <div className="table-page-size">{onPageSizeChange&&<><label htmlFor={pageSizeId}>Số dòng</label><select id={pageSizeId} value={pageSize} onChange={event=>onPageSizeChange(Number(event.target.value))}>{pageSizes.map(size=><option key={size} value={size}>{size}</option>)}</select></>}<span>Hiển thị {from}–{to} / {total}</span></div>
  <div><button type="button" className="button-secondary" disabled={safePage<=1} onClick={()=>onChange(safePage-1)}>Trang trước</button><strong>{safePage} / {pages}</strong><button type="button" className="button-secondary" disabled={safePage>=pages} onClick={()=>onChange(safePage+1)}>Trang sau</button></div>
 </nav>;
}

