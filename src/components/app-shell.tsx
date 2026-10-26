"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import type {ReactNode} from "react";
import {Icon,type IconName} from "./icons";

const navigation:{href:string;label:string;icon:IconName}[]=[
 {href:"/",label:"Phương tiện",icon:"grid"},
 {href:"/catalog",label:"Danh mục phương tiện",icon:"crane"},
 {href:"/materials",label:"Danh mục vật tư",icon:"layers"},
 {href:"/cases",label:"Vụ việc kỹ thuật",icon:"wrench"},
 {href:"/history",label:"Lý lịch phương tiện",icon:"clock"},
 {href:"/requisitions",label:"Phiếu lĩnh vật tư",icon:"check"},
 {href:"/contractor-materials",label:"Vật tư nhà thầu",icon:"shield"},
 {href:"/monthly",label:"Giám sát giờ & sản lượng",icon:"calendar"},
 {href:"/life",label:"Thay thế & định mức",icon:"clock"},
 {href:"/reports",label:"Báo cáo kỹ thuật",icon:"chart"},
 {href:"/login",label:"Tài khoản",icon:"user"},
];
export function AppShell({children}:{children:ReactNode}){
 const path=usePathname();
 if(path==="/login" || path==="/setup")return <main id="noi-dung" className="standalone-main">{children}</main>;
 const active=navigation.find(n=>n.href==="/"?path==="/" || path.startsWith("/equipment/"):path===n.href || path.startsWith(n.href+"/"));
 return <div className="app-shell">
  <a className="skip-link" href="#noi-dung">Chuyển đến nội dung</a>
  <aside className="sidebar" aria-label="Thanh điều hướng tự động mở rộng">
   <Link href="/" className="brand"><span className="brand-mark"><Icon name="crane"/></span><span><strong>TV-EAM</strong><small>CẢNG TÂN VŨ</small></span></Link>
   <p className="nav-caption">KHÔNG GIAN QUẢN LÝ</p>
   <nav aria-label="Điều hướng chính" className="desktop-nav">{navigation.map(n=><Link key={n.href} href={n.href} title={n.label} aria-current={active?.href===n.href?"page":undefined}><Icon name={n.icon}/><span>{n.label}</span></Link>)}</nav>
   <details className="mobile-nav" key={path}><summary>Điều hướng</summary><nav aria-label="Điều hướng trên điện thoại">{navigation.map(n=><Link key={n.href} href={n.href} aria-current={active?.href===n.href?"page":undefined}><Icon name={n.icon}/>{n.label}</Link>)}</nav></details>
   <div className="sidebar-note"><Icon name="shield"/><p>Dữ liệu riêng theo quyền truy cập.<small>Mỗi phương tiện, một lịch sử rõ ràng.</small></p></div>
  </aside>
  <div className="app-body"><header className="topbar"><span>Quản lý kỹ thuật <span className="topbar-divider">/</span> <strong>{active?.label??"Hồ sơ"}</strong></span><Link className="account-link" href="/login" aria-label="Tài khoản"><Icon name="user"/><span>Tài khoản</span></Link></header>
   <main id="noi-dung" className="app-main space-y-6">{children}</main>
   <footer className="app-footer">TV-EAM · Đồng hành cùng công tác kỹ thuật</footer>
  </div>
 </div>;
}


