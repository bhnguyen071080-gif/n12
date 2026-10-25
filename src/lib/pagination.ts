export function paginate<T>(rows:T[],requestedPage:number,pageSize:number){
 const size=Math.max(1,Math.floor(pageSize));
 const pages=Math.max(1,Math.ceil(rows.length/size));
 const page=Math.min(Math.max(1,Math.floor(requestedPage)||1),pages);
 const start=(page-1)*size;
 return {page,pages,items:rows.slice(start,start+size)};
}

