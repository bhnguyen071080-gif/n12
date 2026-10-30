import {AsyncForm} from "@/components/async-form";
import {login,logout} from "@/app/actions";
import {safeNext} from "@/lib/domain";
import {Icon} from "@/components/icons";
export const dynamic="force-dynamic";
export default async function Login({searchParams}:{searchParams:Promise<{next?:string}>}){
 const params=await searchParams;
 return <div className="login-layout">
  <section className="login-scene"><div className="login-brand"><span className="brand-mark"><Icon name="crane"/></span><strong>TV-EAM <small>CẢNG TÂN VŨ</small></strong></div>
   <div className="login-intro"><p className="eyebrow">KẾT NỐI CÔNG TÁC KỸ THUẬT</p><h2>Hiểu từng phương tiện.<br/>Chủ động từng công việc.</h2><p>Theo dõi phương tiện, bảo dưỡng và vật tư<br className="desktop-only"/> trong một không gian làm việc rõ ràng.</p></div>
   <div className="login-scene-footer"><span><Icon name="crane"/>Phương tiện</span><span><Icon name="wrench"/>Bảo dưỡng</span><span><Icon name="layers"/>Vật tư</span></div>
  </section>
  <section className="login-form-area"><div className="login-card"><span className="login-symbol"><Icon name="shield" width="30" height="30"/></span><p className="eyebrow">CHÀO MỪNG TRỞ LẠI</p><h1>Đăng nhập TV-EAM</h1><p className="muted">Vào khu vực dữ liệu được cấp quyền của bạn.</p>
   <AsyncForm action={login} label="Đăng nhập"><input type="hidden" name="next" value={safeNext(params.next)}/><label>Thư điện tử<input type="email" name="email" autoComplete="username" placeholder="Địa chỉ thư điện tử của bạn" required/></label><label>Mật khẩu<input type="password" name="password" autoComplete="current-password" placeholder="Nhập mật khẩu" required/></label></AsyncForm>
   <p className="login-security"><Icon name="shield"/>Quét mã QR vẫn cần tài khoản được cấp quyền. Hồ sơ phương tiện không mở công khai.</p><form action={logout}><button className="button-secondary">Đăng xuất phiên hiện tại</button></form>
  </div><p className="login-bottom">TV-EAM · Quản lý phương tiện và bảo dưỡng</p></section>
 </div>;
}
