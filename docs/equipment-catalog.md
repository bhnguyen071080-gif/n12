# Bước 1: khai báo phương tiện

1. Mở **Danh mục phương tiện**, chọn đúng khu vực dữ liệu.
2. Nhập mã ổn định (chữ không dấu, số, gạch ngang/gạch dưới) và tên. Chọn loại thiết bị đúng; khung cẩu có hai loại riêng.
3. Chọn trạng thái nền đã đối chiếu. Trạng thái đang sửa chữa, bảo dưỡng, chờ vật tư do nghiệp vụ tính, không sửa trực tiếp ở đây.
4. Số chế tạo và năm sản xuất chưa rõ để trống. Mã tham chiếu nguồn cũ cách nhau bằng dấu chấm phẩy; đây chưa phải cấu hình đồng bộ hoặc vị trí lắp.
5. Nhập giờ gốc trước tháng bắt đầu nhập và xác nhận đã đối chiếu. Chưa biết thì chưa lưu, không điền 0 để bỏ qua. Không nhập lại giờ tháng đã nằm trong mốc này.
6. Bấm **Lưu phương tiện** và chờ thông báo. Có thể mở hồ sơ hoặc nhập phương tiện tiếp theo. Gửi lại cùng yêu cầu không tạo thêm bản sao; mã trùng trong khu vực bị chặn.
7. Bấm **Chỉnh sửa** ở phương tiện đã có để sửa thông tin. Mã/giờ gốc được giữ nguyên; khi có người sửa cùng lúc, tải lại trang trước khi tiếp tục, không ghi đè bản mới.

Chỉ trưởng bộ phận của khu vực được thêm/sửa; các vai trò được đọc theo RLS hiện hành. Không tự cấp vai trò hoặc mở dữ liệu công khai. Các thay đổi có nhật ký hiện hữu của bảng phương tiện. Chưa có nút xóa, tải ảnh hoặc khai báo lịch sử lắp/tháo trong bước này.

## Triển khai và kiểm tra

Áp dụng migration `equipment_catalog` một lần trước bản web; giữ toàn bộ migration cũ. Không nhập dữ liệu mẫu vào cloud thật. Kiểm tra SQL ở cơ sở dữ liệu tạm của CI và giao dịch hoàn tác trên cloud, không để lại phương tiện thử. Kiểm tra quyền ghi/xem, loại khung cẩu, mã trùng, gửi lại, phiên bản sửa, mã/giờ gốc bất biến trong RPC và trường chưa biết không bị suy đoán.
