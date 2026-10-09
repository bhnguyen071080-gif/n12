import type {Metadata} from "next";
import Link from "next/link";
import "./globals.css";
import {Pwa} from "@/components/pwa";
export const metadata:Metadata={title:"TV-EAM · Tân Vũ",description:"Quản lý phương tiện, giờ hoạt động và định mức",manifest:"/manifest.webmanifest",icons:{icon:"/icon.svg",apple:"/icon.svg"}};
export default function Layout({children}:{children:React.ReactNode}){
 return <html lang="vi"><body className="tabular-nums"><header className="bg-slate-900 p-4 text-white"><strong>TV-EAM · Tân Vũ</strong><nav className="mt-3 flex flex-wrap gap-5">
  <Link className="text-white" href="/">Phương tiện</Link><Link className="text-white" href="/monthly">Ba bảng tháng</Link><Link className="text-white" href="/life">Định mức & bảo dưỡng</Link><Link className="text-white" href="/reports">Báo cáo kỹ thuật</Link><Link className="text-white" href="/login">Tài khoản</Link>
 </nav></header><main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">{children}</main><Pwa/></body></html>;
}
