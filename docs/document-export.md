# Biểu mẫu và in theo vụ việc

## Luồng hiện hành

### Phiếu lĩnh BM.08.06 từ 20/10/2026

Phần ký dành khoảng trống 25 mm dưới hướng dẫn ký, trước họ tên in sẵn. Khuôn A5 tự tính từ số dòng đã xuống hàng của phần đầu, bảng, tiền bằng chữ và tên người ký; không cố định số hạng mục. Trường hợp phần đầu ngắn và mỗi vật tư một dòng chữ, khoảng 4 hạng mục vừa mỗi phiếu; nội dung dài giảm số dòng. Dòng vượt phần còn lại chuyển sang phần tiếp theo, mỗi phần ghép hai bản giống nhau trên A4; không co chữ hoặc cắt mất phần ký. Phiếu mới không in mã vụ việc hay phiên bản ở chân phiếu; nhiều phần chỉ có chỉ số phần màu xám nhạt. Mã vụ việc vẫn được giữ trong dữ liệu liên kết và tên tệp.

Phiếu mới có đúng thông tin mẫu: cơ quan, phòng, họ tên người nhận hàng, lý do xuất kho, lĩnh tại kho; bảng STT/tên và quy cách/danh điểm/ĐVT/xin lĩnh/thực phát/đơn giá/thành tiền, cộng tiền bằng chữ. Bốn ô ký theo thứ tự Phòng TCKT, Thủ kho, Người nhận, Lãnh đạo Phòng. Người nhận chỉ nhập một lần, dùng ở đầu phiếu và ô ký. Không sao chép người, số lượng hay lý do đã điền trong tệp mẫu.

Lần mở phiếu mới kế thừa tên vật tư, quy cách, danh điểm, ĐVT, số lượng gợi ý và thông tin cơ quan từ biên bản tình trạng mới nhất mà người dùng có quyền đọc trong chính vụ việc. Snapshot lưu basis_document_id để truy về bản biên bản bất biến; không lấy biên bản vụ việc khác. Số thực phát, đơn giá, kho và người nhận không được suy diễn. Các dòng kế thừa có usage_id=null, chỉ là nội dung giấy đề nghị, không tạo danh mục vật tư, giao dịch kho, tiến độ hay trả phiếu. Phiếu đã lưu luôn giữ các chỉnh sửa của mình, không tự thay bởi biên bản mới hơn. Bản cũ không có voucher_template vẫn in theo cấu trúc năm chữ ký cũ; khi chỉnh sửa sẽ tạo phiên bản mới theo mẫu bốn chữ ký.

Vụ việc → Biểu mẫu & In → chọn biên bản/phiếu lĩnh → chỉnh nội dung, chọn dòng vật tư → xác nhận đã kiểm tra → lưu phiên bản → xem/in PDF → lưu PDF lên Drive riêng tư.

Mỗi bản xuất là snapshot append-only trong PostgreSQL cloud. Sửa nguồn không đổi bản đã lưu; sửa bản xuất phải tạo phiên bản mới. Mã vụ việc/mã hồ sơ liên kết do database lấy, không nhận từ browser. Ngày lập, số biên bản/phiếu và nội dung in được chỉnh riêng, không đổi ngày thực hiện kỹ thuật.

Biên bản gồm thành phần tham gia, bảng vật tư/quy cách/ĐVT/số lượng/định mức/thực hiện/tình trạng/ghi chú, nguyên nhân và biện pháp khắc phục. Phiếu giữ các cột danh điểm, xin lĩnh, thực phát, đơn giá, thành tiền và năm phần ký. Không tự tạo chữ ký, không dùng người/ngày/kết luận có sẵn trong mẫu làm dữ liệu thật. Đơn vị và thành phần của bản xuất gần nhất được gợi ý; phải kiểm tra lại.

Số xin lĩnh mặc định từ dòng theo dõi, được chỉnh chỉ trong snapshot. Thực phát và đơn giá ban đầu trống, không bằng xin lĩnh và không coi chưa biết là 0. Thành tiền chỉ tính từ thực phát × đơn giá. Định mức/thực hiện giờ cần kỳ tháng đã đối chiếu; không tự suy diễn thiếu tháng thành 0.

Hiện một bản xuất thuộc một vụ việc/phương tiện; chọn nhiều dòng vật tư và hạng mục trong vụ việc. Chưa gom nhiều phương tiện vào một biên bản, tránh làm mất liên kết hoặc phân bổ vật tư sai.

## Khổ in và phiên bản

- Biên bản: A4 dọc, bảng có thể tiếp sang trang mới, lặp tiêu đề; không sinh trang trắng do bảng thả nổi.
- Phiếu: mỗi phần A5 ngang được ghép hai bản giống nhau trên một A4 dọc. Khi nhiều dòng, mỗi phần tiếp theo cũng có hai bản giống nhau và chỉ số phần. Không cắt dòng hoặc ép chữ nhỏ; dòng riêng quá dài được từ chối với thông báo chỉnh nội dung.
- In A4, 100%/kích thước thực; không áp dụng thêm hai trang trên một tờ.
- PDF dùng font serif có dấu được nhúng; bộ font không cần cài lên máy sử dụng.
- Bản đã lưu Drive được đọc lại nguyên byte, kiểm tra SHA-256, không dựng lại bằng renderer mới. Không ghi đè bản đã lưu.

## Triển khai cloud

Áp dụng migration 20261013013749_case_document_exports.sql sau các migration đã có. Không chạy lại foundation trên database đang dùng. Table case_documents có RLS; SELECT theo loại hồ sơ/vai trò và workspace, INSERT/UPDATE/DELETE trực tiếp bị từ chối. RPC lưu kiểm tra quyền, nguồn thay đổi, dòng vật tư thuộc vụ việc, request idempotency và số phiên bản; trigger bảo vệ snapshot, audit old/new.

Tài khoản kỹ thuật/trưởng bộ phận lập và đọc biên bản; kỹ thuật/vật tư/trưởng bộ phận lập và đọc phiếu lĩnh. Đội sản xuất không truy cập bản xuất. Tài khoản cá nhân giữ các vai trò cần thiết qua membership đã được quản trị cấp, không tự cấp quyền từ React.

Lưu và tải PDF không chỉnh bất kỳ tiến độ, vật tư, tồn kho, thời điểm thay hay trạng thái trả phiếu nào. Đây là soạn và lưu hồ sơ, không thay thế nghiệp vụ xác nhận xuất kho.

## Kết nối Google Drive của ứng dụng

Plugin Drive trong cuộc trò chuyện KHÔNG phải kết nối của website. Kết nối server của website cần OAuth client riêng và người chủ cấp quyền. Không gửi token/secret vào chat, không commit vào GitHub; đặt biến server-only của .env.example qua secret manager nền tảng triển khai.

- GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET / GOOGLE_DRIVE_REFRESH_TOKEN: OAuth người dùng, không dùng service account để sở hữu tệp trên My Drive cá nhân.
- GOOGLE_DRIVE_FOLDERS: JSON ánh xạ workspace UUID → folder ID được chọn/tạo với cùng OAuth client. Quyền drive.file không tự cho phép truy cập mọi tệp trong thư mục; cần kiểm tra folder đã được cấp cho app. Không bật chia sẻ công khai.
- SUPABASE_SERVICE_ROLE_KEY: chỉ phía server để xác nhận upload đã kiểm tra. Không dùng để đọc nguồn hay lưu snapshot; những bước này dùng session và RLS của người đăng nhập. Hàm finalization chỉ service_role được gọi, kiểm tra lại membership đang active của actor và ghi audit đúng actor.

Trước khi lưu Drive, kiểm tra folder không chia sẻ kiểu anyone/domain. Xin file ID trước và lưu lease vào database; mọi lần thử lại dùng cùng ID. Upload, kiểm tra appProperties, folder, SHA-256 của byte thật rồi mới đánh dấu saved. Mất mạng giữ snapshot và file ID; thử lại cùng phiên bản, không tạo bản mới. Không có API cấp quyền chia sẻ tệp trong luồng này.

Khi chưa cấu hình Drive, UI nói rõ snapshot cloud đã lưu nhưng PDF chưa lưu trên Drive. Không báo thành công giả. Kết nối OAuth Testing có thể hết hạn sau 7 ngày; cấu hình publishing/consent thích hợp và xử lý kết nối lại khi đưa vào sử dụng.

## Phạm vi kiểm chứng

TypeScript strict, unit tests source mapping/date/quantities, PDF deterministic/pagination/A5 overflow, SQL snapshots/RLS/no-business-mutations/Drive leases/actor audit. Kiểm tra PDF bằng Poppler/Python và ảnh từng trang với dữ liệu giả lập. CI browser smoke chỉ kiểm tra các cổng cấu hình/login, chưa chứng minh luồng người dùng đăng nhập thật.

Chưa có Supabase project/deployment/OAuth credentials thật trong phiên làm việc; chưa upload hồ sơ thật. Mẫu Word gốc và bản phân tích giữ ngoài repository công khai. Mã in PDF được viết theo cấu trúc mẫu đã duyệt, không phát hành tệp mẫu thật. Tải Word DOCX chưa có trong phiên bản này; không gắn nhãn DOCX cho HTML hoặc tuyên bố DOCX đã được kiểm tra khi chưa có renderer tương ứng.
