# Luồng theo dõi cá nhân

1. Vào Vụ việc & vật tư, chọn phương tiện, loại việc, ngày thực hiện và nội dung.
2. Mở vụ việc, cập nhật từng hạng mục: ngày thực hiện, bốn nội dung, sáu nhóm tiến độ.
3. Thêm nhiều loại vật tư, ghi vay/lĩnh ngay; xác nhận đã thay khi thực hiện thực tế.
4. Theo dõi trả phiếu chung ở đầu vụ việc, ghi thời gian hoàn tất. Không tạo phiếu kho.
5. Lý lịch tự đọc cùng dữ liệu. Thêm vật tư sau hoàn tất tự mở lại cảnh báo.
6. Ba bảng tháng → Giờ hoạt động: phương tiện, từ tháng, đến tháng → tổng và từng tháng thiếu.
7. Giờ vật tư & định mức: chọn phương tiện/đến tháng, xem lượt thay gần nhất; bấm khoảng tháng để đối chiếu tổng giờ.
8. Khai báo định mức giờ cho cáp, búa hoặc vật tư khác nếu cần. Không nhập lại ngày thay hoặc số đồng hồ khi lắp.

## Nâng cấp
Backup database cloud; chỉ chạy migration chưa áp dụng, đúng thứ tự. Database đã đến 007 chỉ chạy 008 rồi 009.
Không chạy tests/sql hoặc fixture trên database thật. Không đổi tracking_only cho bản ghi cũ một cách tự động.
Cấp cán bộ các vai trò cần thiết trong workspace, không cần nhiều cấp ký.
Giữ khóa Supabase/Google trong môi trường triển khai, không commit.
start_month của nguồn Sheets chỉ giới hạn tháng đọc; không yêu cầu giờ ban đầu trong luồng mới.

## Kiểm chứng
CI dùng PostgreSQL tạm với dữ liệu giả, kiểm tra quyền, audit, trạng thái, thử lại/đồng thời và tổng giờ.
Browser smoke chỉ kiểm tra cổng cấu hình/chưa đăng nhập; không chứng nhận thao tác đăng nhập trên cloud thật.
Chạy production build không đồng nghĩa đã triển khai hay đã đồng bộ dữ liệu thật.
