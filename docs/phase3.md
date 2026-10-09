# Giai đoạn 3 – Hợp đồng nghiệp vụ

## Ba bảng tháng độc lập

| Bảng vật lý | Nội dung | Khóa nghiệp vụ | RPC import |
|---|---|---|---|
| monthly_operating_hours | Tổng giờ máy thực chạy trong tháng | equipment_id + month | import_operating_months |
| monthly_production | Số container (chiếc), không quy đổi | equipment_id + month | import_container_months |
| monthly_other_cargo | Sản lượng hàng khác, đơn vị theo cargo_types | equipment_id + month + cargo_type_id | import_other_cargo_months |

Bảng giờ hoạt động không có cột giờ hư hỏng. Không điền giờ chạy giả khi chỉ nhập số container. Import độc lập, retry idempotent, upsert theo khóa nghiệp vụ, một lô sai rollback toàn bộ. Migration 006 ngừng API import_monthly_metrics cũ; giao diện chỉ dùng ba luồng import độc lập.

initial_hours là số đồng hồ lúc bắt đầu quản lý. accumulated_hours = initial_hours + tổng các tháng đã nhập. Chỉ nhập các tháng sau mốc baseline, không nhập lại những giờ đã nằm trong baseline. Hiệu chỉnh tháng tính chênh lệch, không cộng toàn bộ lần nữa.

## Định mức và bảo dưỡng

equipment_life_items lưu từng lần lắp cáp/búa khung cẩu/bộ phận khác: vị trí, giờ đồng hồ khi lắp, định mức giờ, ngưỡng cảnh báo, vật tư sử dụng liên kết nếu có.
Giờ đã dùng = accumulated_hours - installed_meter_hours. Thay bộ phận phải kết thúc lần lắp cũ và tạo lần mới; không xóa lịch sử.
Nếu chỉnh giờ tháng làm lũy kế nhỏ hơn mốc lắp, cảnh báo invalid_meter, không âm thầm ép về 0.
vw_component_life và vw_maintenance_due luôn truy vấn giờ lũy kế hiện tại. Không có bảng giờ hư hỏng tổng hợp trộn vào giờ tháng.

## Độ tin cậy

Người dùng xác nhận giờ tháng là **giờ thực chạy**. H = tổng giờ thực chạy; D = tổng khoảng dừng sự cố đã xác nhận trong kỳ (hợp nhất khoảng trùng, cắt theo biên kỳ UTC+7); N = số sự cố xác nhận bắt đầu trong kỳ.
- MTBF = H / N. Không dùng (H - D) / N vì H đã loại giờ dừng.
- MTTR quan sát trong kỳ = D / N.
- Availability đối với sự cố = H / (H + D) × 100%.
- Không có sự cố: MTBF/MTTR=NULL, không hiển thị vô cực hay 0 giả.
- H=D=0: Availability=NULL. Thiếu tháng giờ: MTBF/Availability=NULL.
- Sự cố bắt đầu trước kỳ hoặc chưa phục hồi: hiện carry_in_failures/open_failures. MTTR là chỉ số theo cửa sổ, không phải MTTR cohort đầy đủ; đánh dấu tạm tính nếu có sự cố qua kỳ.
- Bảo dưỡng kế hoạch và các loại dừng khác không tính vào D. Đây không phải Availability theo lịch 24/7.
- Khoảng dừng cũ mặc định unclassified. Không tự xem mọi hồ sơ sửa chữa là sự cố. Cần kỹ thuật xác nhận/phân loại.
- Báo hỏng nhanh tạo sự cố chưa xác nhận; kỹ thuật xác nhận rồi mới tính vào báo cáo.
- Một sự cố có một nguyên nhân chính (bốn nhóm + chưa phân loại), không đếm số hạng mục thành số lần hỏng.

Tham khảo định nghĩa chuẩn: https://www.ibm.com/think/topics/mttr-vs-mtbf
RLS và security-invoker: https://supabase.com/docs/guides/database/postgres/row-level-security

## Chi phí

Giá snapshot ở repair_material_usages.unit_cost_vnd, VND. Ngày hạch toán kỹ thuật = ngày lắp thực tế UTC+7, không phải ngày hoàn thiện giấy tờ. Chi phí kỳ = lượng × đơn giá snapshot; không nhân với giá danh mục hiện tại.
Chưa định giá có bộ đếm riêng. Chỉ ghi tổng chi phí VND và tổng số container (chiếc) trong kỳ; không tính TEU hoặc tỷ suất quy đổi. Khi thiếu tháng container, có bộ đếm chất lượng dữ liệu; ô trống không ép thành 0.
Báo cáo ghi rõ kỳ [from,to), lọc tháng/quý bằng cách chọn biên tháng. Đây là báo cáo chi phí vật tư, chưa bao gồm nhân công/dịch vụ/khấu hao/thuế.

## Tồn đọng

Nhóm kỹ thuật: hạng mục chưa hoàn thành. Nhóm thủ tục: hạng mục hoàn thành, thiết bị đang available, nhưng nợ vay/phiếu/chứng từ. Các khoản vay không cộng tổng số lượng giữa các đơn vị khác nhau: số lượng chi tiết theo vật tư.
Không ép sáu tiến độ thành một trạng thái hồ sơ. Cùng thiết bị có thể có hạng mục khác nhau thuộc hai nhóm.

## Toàn chi nhánh và QR

Một workspace dùng chung cho chi nhánh, equipment_teams phân nhóm đội quản lý, vai trò membership dùng chung như Giai đoạn 2. Không tự tạo tài khoản/quyền. Quyền trưởng bộ phận xem toàn bộ workspace; không vượt workspace.
Đội quản lý là phân nhóm báo cáo, không phải ranh giới phân quyền mới. Nếu cần chỉ xem thiết bị đội mình thì phải thiết kế thêm chính sách; không giả định đã có.
QR chứa URL tuyệt đối từ APP_BASE_URL, equipment code và workspace UUID; không chứa token. Quét vẫn bắt đăng nhập và RLS. Mã phương tiện trùng giữa các workspace không bị chọn nhầm.
Chưa tạo dự án Supabase/Vercel; cần chọn dự án và xác nhận chi phí trước khi cấp tài nguyên thật. Không cần WSL2 hay máy chủ doanh nghiệp.

## Sửa yêu cầu: chỉ số container, không TEU

Luồng hiện hành chỉ nhận equipment_code, month, boxes (số nguyên không âm).
Form, CSV, Google Sheets preview/snapshot, bảng tháng và CSV báo cáo không có TEU.
Bỏ chỉ tiêu chi phí/1.000 TEU; không tự thay bằng chi phí/1.000 container khi chưa được yêu cầu.
Migration 006 giữ cột và snapshot lịch sử cũ, khóa thay đổi trường quy đổi bằng trigger, ngừng API/view cũ. Không xóa dữ liệu để chuyển yêu cầu.
Bộ kiểm thử nâng cấp tạo dữ liệu ở hợp đồng 001–005, chạy regression lịch sử, sau đó áp dụng 006 và kiểm tra hợp đồng mới. Đây không phải cho phép TEU ở phiên bản hiện tại.
