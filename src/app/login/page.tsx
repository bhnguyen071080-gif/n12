import {AsyncForm} from "@/components/async-form";
import {login,logout} from "@/app/actions";
import {safeNext} from "@/lib/domain";
export const dynamic="force-dynamic";
export default async function Login({searchParams}:{searchParams:Promise<{next?:string}>}){
 const params=await searchParams;
 return <section className="panel mx-auto max-w-md"><h1>Đăng nhập TV-EAM</h1><AsyncForm action={login} label="Đăng nhập">
  <input type="hidden" name="next" value={safeNext(params.next)}/><label>Email<input type="email" name="email" autoComplete="username" required/></label>
  <label>Mật khẩu<input type="password" name="password" autoComplete="current-password" required/></label>
 </AsyncForm><p>Quét QR vẫn cần tài khoản được cấp quyền, không mở công khai hồ sơ phương tiện.</p><form action={logout}><button>Đăng xuất phiên hiện tại</button></form></section>;
}
