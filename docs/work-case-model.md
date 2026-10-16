# TV-EAM: vụ việc, lý lịch và vật tư — chốt 12/10/2026

## Phạm vi
Luồng cá nhân tổng hợp theo dõi, không lập/phát hành phiếu hay ghi sổ kho.
Một cán bộ có thể mang các vai trò cần thiết, không cần nhiều cấp ký.
Bảng/giá trị kho và đồng hồ cũ được giữ nguyên để bảo toàn lịch sử.

## Mã và ngày thực hiện
- Loại việc SC sửa chữa, BD bảo dưỡng, VS vệ sinh, KT kiểm tra.
- Mã mới: SC-QC10-DDMMYYYY-HHmm-0001, ngày giờ do database cấp tại lúc nhập, UTC+7.
- Hậu tố nguyên tử theo phương tiện/loại/ngày nhập để không trùng trong cùng phút.
- UUID là khóa liên kết; mã HS riêng, một hồ sơ nhiều hạng mục.
- Ngày thực hiện ghi trên từng hạng mục (`performed_on`), không lấy ngày nhập làm ngày sửa chữa.
- Vật tư đã thay lấy chính ngày thực hiện này. Sửa ngày sẽ đồng bộ, không nhập ngày thay ở nơi thứ hai.
- Mã và created_at bất biến; mã/dữ liệu cũ không cấp lại, không đoán ngày còn thiếu.
- Báo hỏng nhanh và chuyển kiểm tra bất thường sang sửa chữa mới liên kết luồng theo dõi.

## Vật tư và trả phiếu
```text
Phương tiện → Vụ việc → Hồ sơ HS → Hạng mục → Nhiều dòng vật tư
                 └→ Một trạng thái trả phiếu chung + thời gian hoàn tất
```
Giữ bốn nội dung kỹ thuật và sáu tiến độ riêng từng hạng mục.
Vật tư: loại/đơn vị/số lượng, vay/lĩnh, đã thay hay chưa, vị trí mô tả.
Trả phiếu: Chưa hoàn tất / Đã hoàn tất, thời gian và ghi chú; không lập phiếu trong TV-EAM.
Đã thay không đồng nghĩa đã trả phiếu; đã trả phiếu không đồng nghĩa đã thay.
Thêm vật tư tự mở lại trả phiếu, xóa thời gian hiện hành nhưng giữ lần hoàn tất trước trong audit.
Tăng phiên bản trạng thái mỗi lần thêm dòng để chặn chốt trả phiếu trên dữ liệu cũ.
Sửa số lượng sau hoàn tất cần mở lại trạng thái trước.
Thiết bị hoàn thành công việc vẫn có thể chạy bình thường khi còn nợ trả phiếu.
Vị trí chỉ mô tả; lượt thay gần nhất tra theo phương tiện + loại vật tư + ngày thực hiện.

## Giờ hoạt động
Ba bảng độc lập: monthly_operating_hours, monthly_production (container chiếc), monthly_other_cargo.
Không yêu cầu giờ đồng hồ ban đầu hay giờ khi lắp cho cách tính mới.
Bộ lọc phương tiện / từ tháng–năm / đến tháng–năm thủ công; tính cả hai tháng đầu cuối.
Mặc định đến tháng hiện tại nếu phương tiện đã có dữ liệu tháng đó, nếu chưa có thì tháng liền trước.
Tổng giờ vật tư lấy từ tháng thay gần nhất trong lý lịch đến tháng chọn. Thay giữa tháng tính tương đối cả tháng.
Ô trống là thiếu dữ liệu; số 0 là số đã xác nhận. Tổng thiếu tháng được gắn cảnh báo, không kết luận giờ còn lại như đủ dữ liệu.
Sửa giờ tháng tự thay đổi kết quả truy vấn. Không nhập giờ dừng vào bảng giờ hoạt động.
Đồng hồ và kế hoạch dựa trên đồng hồ cũ được bảo toàn nhưng không phải cách tính giờ vật tư hiện hành.

## An toàn
RLS, quyền từng trường ở trigger, RPC kiểm tra vai trò, view security_invoker, audit old/new.
RPC hạng mục dùng version và request key. Vụ việc/vật tư không tạo trùng khi thử lại.
Không xóa lịch sử, không đưa dữ liệu Sheets hay bí mật vào repository công khai.
Migrations 008–009 là bổ sung; không chạy lại foundation hoặc fixture trên database thật.
