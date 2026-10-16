# Bước 1: khai báo phương tiện

1. Mở **Danh mục phương tiện**, chọn đúng khu vực dữ liệu.
2. Nhập mã ổn định (chữ không dấu, số, gạch ngang/gạch dưới) và tên. Chọn loại thiết bị đúng; khung cẩu có hai loại riêng.
3. Chọn trạng thái nền đã đối chiếu. Trạng thái đang sửa chữa, bảo dưỡng, chờ vật tư do nghiệp vụ tính, không sửa trực tiếp ở đây.
4. Số chế tạo và năm sản xuất chưa rõ để trống. Mã tham chiếu nguồn cũ cách nhau bằng dấu chấm phẩy; đây chưa phải cấu hình đồng bộ hoặc vị trí lắp.
5. Không nhập giờ máy trong danh mục. Có thể lưu phương tiện trước khi biết giờ gốc; hệ thống giữ giờ gốc và lũy kế chưa xác định, không tự điền 0.
6. Bấm **Lưu phương tiện** và chờ thông báo. Có thể mở hồ sơ hoặc nhập phương tiện tiếp theo. Gửi lại cùng yêu cầu không tạo thêm bản sao; mã trùng trong khu vực bị chặn.
7. Bấm **Chỉnh sửa** ở phương tiện đã có để sửa thông tin. Mã và dữ liệu giờ được giữ nguyên; khi có người sửa cùng lúc, tải lại trang trước khi tiếp tục, không ghi đè bản mới.

## Giám sát giờ hoạt động

Mở **Giám sát giờ & sản lượng**, chọn **Giờ hoạt động** và phương tiện. Người quản lý nhập **Giờ gốc đã đối chiếu** cùng **Tháng bắt đầu theo dõi**, xác nhận không cộng trùng. Mốc đã xác nhận không sửa lại bằng danh mục. Giờ gốc cũ được giữ nguyên khi bổ sung mốc tháng.

Có thể ghi nhận giờ thực chạy từng tháng khi chưa có giờ gốc; tổng theo khoảng tháng vẫn dùng số liệu thực, nhưng lũy kế đồng hồ chưa xác định. Khi xác nhận, hệ thống tính giờ gốc cộng giờ các tháng hiện có đúng một lần. Nếu đã có tháng trước mốc dự định, hệ thống từ chối để đối chiếu riêng, không xóa dữ liệu. Sau xác nhận, không nhập tháng nằm trước mốc.

Chỉ trưởng bộ phận của khu vực được thêm/sửa; các vai trò được đọc theo RLS hiện hành. Không tự cấp vai trò hoặc mở dữ liệu công khai. Các thay đổi có nhật ký hiện hữu của bảng phương tiện. Chưa có nút xóa, tải ảnh hoặc khai báo lịch sử lắp/tháo trong bước này.

## Triển khai và kiểm tra

Áp dụng các migration `equipment_catalog`, `separate_operating_baseline` theo thứ tự trước bản web tương ứng; giữ toàn bộ migration cũ. Không nhập dữ liệu mẫu vào cloud thật. Kiểm tra SQL ở cơ sở dữ liệu tạm của CI và giao dịch hoàn tác trên cloud, không để lại phương tiện thử. Kiểm tra quyền ghi/xem, mã trùng, gửi lại, phiên bản sửa, bảo toàn giờ cũ, khởi tạo lũy kế từ tháng đã có, hiệu chỉnh tháng theo chênh lệch và không cộng trùng mốc.
