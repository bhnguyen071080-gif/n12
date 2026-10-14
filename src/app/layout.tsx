import type {Metadata} from "next";
import "./globals.css";
import {Pwa} from "@/components/pwa";
import {AppShell} from "@/components/app-shell";
export const metadata:Metadata={title:"TV-EAM · Tân Vũ",description:"Quản lý phương tiện, giờ hoạt động và định mức",manifest:"/manifest.webmanifest",icons:{icon:"/icon.svg",apple:"/icon.svg"}};
export default function Layout({children}:{children:React.ReactNode}){
 return <html lang="vi"><body className="tabular-nums"><AppShell>{children}</AppShell><Pwa/></body></html>;
}
