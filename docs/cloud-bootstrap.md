# Khởi tạo cơ sở dữ liệu đám mây

Ngày 13/10/2026 đã áp dụng các bộ lệnh 001–009, xuất biểu mẫu và tăng cường bảo vệ truy cập lên một dự án Supabase mới theo xác nhận của chủ dữ liệu. Không ghi mã dự án, thông tin tài khoản hay khóa kết nối vào tài liệu công khai này.

## Kết quả và giới hạn

- 29 bảng nghiệp vụ đều bật bảo vệ từng dòng; 10 bảng tổng hợp dùng quyền của người truy vấn.
- Số container chỉ ghi nhận chiếc; giờ hoạt động và hàng khác nằm ở hai bảng riêng.
- Kiểm tra trực tiếp bằng giao dịch hoàn tác: cộng giờ theo chênh lệch khi sửa tháng, khoảng tháng bao gồm hai đầu, tháng thiếu không đổi thành 0, tạo vụ việc không trùng khi gửi lại, vay/lĩnh chưa đồng nghĩa đã lắp, trả phiếu chung và ngày thay theo lý lịch.
- Toàn bộ dữ liệu/tài khoản thử được hoàn tác. Không nhập dữ liệu thực tế hoặc tự gửi thư mời.
- Hàm bảo vệ tự động do trang quản trị tạo được thu hồi quyền gọi từ khách; 21 chỉ mục liên kết được bổ sung và chính sách truy cập lưu đệm định danh cho từng câu truy vấn.
- Sau kiểm tra không còn cảnh báo bảo mật mức cảnh báo/lỗi. Bảng sổ yêu cầu nội bộ không có chính sách người dùng là chủ ý: không cấp quyền trực tiếp cho khách.
- Còn 5 đề xuất tăng tốc về chính sách cho phép chồng nhau (luồng cũ và luồng theo dõi cá nhân). Chưa gộp chúng để tránh thay đổi ngữ nghĩa phân quyền. Các chỉ mục chưa dùng là bình thường khi chưa có dữ liệu; không xóa chỉ mục chỉ vì thông báo này.
- Chưa triển khai web, đăng nhập thật, kết nối Drive/Sheets hoặc xuất tài liệu thật.

## Không chạy lại bộ lệnh đã áp dụng

Lịch sử cập nhật trên đám mây được công cụ kết nối ghi thời điểm triển khai, với tên `tv_eam_<mã bộ lệnh nguồn>`. Sổ đối chiếu cụ thể giữ riêng ngoài repository. Trước khi dùng `supabase db push`, phải đối chiếu và sửa lịch sử bằng quy trình chính thức; không đẩy mù các tệp nguồn cũ và không xóa bảng để làm khớp lịch sử.

`tests/sql/fixture.sql` và các bộ kiểm tra có dữ liệu cố định chỉ dành cho cơ sở dữ liệu dùng một lần, **không chạy trên Supabase thật**.

Riêng `tests/sql/cloud_bootstrap_smoke.sql` là kiểm tra khởi tạo có chủ ý, một kết nối, chạy dưới quyền quản trị trong giao dịch và kết thúc bằng `rollback`. Không dùng nó như bộ nhập dữ liệu. Đọc mã, kiểm tra không có thay đổi ngoài giao dịch và chọn đúng dự án trước khi chạy. Không mô phỏng kết nối Auth/Drive thành công chỉ từ kết quả kiểm tra SQL.

## Bước tiếp theo

Tạo tài khoản sử dụng ứng dụng qua chức năng quản lý tài khoản của Supabase (không chèn mật khẩu bằng SQL). Sau đó tạo không gian quản lý và cấp các vai trò cần thiết cho đúng tài khoản cá nhân; chỉ tiếp tục khi đã xác nhận người dùng. Đưa đúng nhánh mã lên web, cấu hình các khóa riêng trong nơi lưu bí mật của nền tảng, rồi kiểm tra luồng đăng nhập và vụ việc trên điện thoại/máy tính.

Nguồn hướng dẫn: [bảo vệ dữ liệu](https://supabase.com/docs/guides/api/securing-your-api), [tăng tốc chính sách](https://supabase.com/docs/guides/database/postgres/row-level-security#rls-performance-recommendations), [đề xuất chính sách chồng nhau](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies).
