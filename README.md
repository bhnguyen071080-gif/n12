## Nhập bảng Excel / CSV 14/10/2026

Mục `/imports` nhận bộ mẫu Excel có cột tiếng Việt cho danh mục phương tiện, vật tư, loại hàng và ba bảng tháng. Có tải mẫu, chọn tệp/dán bảng, lỗi từng dòng/cột, đối chiếu dòng mới/thay đổi/không đổi trước xác nhận. Chỉ thêm mới là mặc định; thay dòng đã có cần lựa chọn và xác nhận riêng. Không xóa dòng ngoài tệp, không ép trống thành 0, không nhập giờ gốc trong danh mục, không tạo tồn kho từ vật tư. Tối đa 500 dòng/lô; cả lô nguyên tử, thử lại an toàn và chặn bản xem trước lỗi thời. Có `/materials` để xem danh mục vật tư/loại hàng. Áp dụng migration `bulk_table_import` trước bản web. [Hướng dẫn](docs/table-import.md).

## Bước 1 · Danh mục phương tiện 14/10/2026

Màn hình `/catalog` thêm/sửa mã, tên, loại, trạng thái nền, số chế tạo, năm sản xuất, mã tham chiếu và ghi chú. Có phân loại riêng khung cẩu bán tự động/tự động. Chỉ trưởng bộ phận trong khu vực được ghi; SQL chạy với quyền người dùng và RLS hiện có, kiểm tra trùng mã, gửi lại an toàn và phiên bản sửa để tránh ghi đè. Mã định danh và giờ ban đầu không được sửa trong biểu mẫu chỉnh danh mục; trạng thái sửa chữa/bảo dưỡng vẫn do nghiệp vụ tính.

Danh mục không yêu cầu nhập giờ máy. Giờ gốc cùng tháng bắt đầu được xác nhận riêng trong **Giám sát giờ hoạt động**; chưa biết giữ NULL, không tự điền 0. Có thể ghi nhận giờ chạy tháng trước khi có giờ gốc, nhưng chưa có lũy kế đồng hồ. Mốc xác nhận cộng giờ tháng hiện có đúng một lần và chặn nhập các tháng trước mốc. Số chế tạo/năm chưa rõ để trống. Không tự thêm phương tiện mẫu/thực tế, không có nút xóa. Ảnh thiết bị và lịch lắp/tháo là bước tiếp, chưa triển khai trong bước này. Các migration `equipment_catalog`, `separate_operating_baseline` phải áp dụng đúng thứ tự trước bản web tương ứng; không chạy lại foundation. [Hướng dẫn](docs/equipment-catalog.md).

## Giao diện cảng biển 14/10/2026

Hoàn thiện chiều sâu giao diện: mục điều hướng dạng khuôn nổi có viền sáng/bóng đổ, lựa chọn hiện tại có dấu cam; ô và vùng nhập liệu có bóng lõm phía trong. Giữ viền nhận biết ô, đánh dấu tiêu điểm bàn phím, bố cục điện thoại và chế độ in sạch. Chỉ sửa trình bày, không thay dữ liệu/quyền/nghiệp vụ.

Trang đăng nhập có minh họa cảng biển nguyên bản, tông xanh biển–cam. Điều hướng thích ứng điện thoại, thẻ tổng hợp theo dữ liệu được cấp quyền, tìm phương tiện theo mã/tên không dấu và lọc trạng thái. Danh mục trống có hướng dẫn, không tạo số liệu hoặc phương tiện mẫu trong dữ liệu thật. Không đổi đăng nhập, phân quyền, công thức nghiệp vụ hay tiến độ sửa chữa. Minh họa không phải ảnh hiện trường hoặc logo của đơn vị khác.

## Biểu mẫu và in 13/10/2026

Đã bổ sung soạn biên bản/phiếu lĩnh từ vụ việc, chỉnh trước khi xuất, lưu phiên bản cloud bất biến, PDF A4 và hai bản A5 trên A4, cùng adapter lưu PDF vào Google Drive riêng tư khi có cấu hình OAuth của ứng dụng. Không tự xác nhận lĩnh/thay/trả phiếu. [Hướng dẫn triển khai và giới hạn](docs/document-export.md).

Chưa triển khai production hoặc kết nối Drive thật. Bản này xuất PDF; chưa có tải Word DOCX.

## Cập nhật nghiệp vụ cá nhân 12/10/2026

Luồng /cases: vật tư theo vụ việc, trả phiếu chung, ngày thực hiện theo từng hạng mục.
Giờ máy: lọc phương tiện/từ tháng/đến tháng, tính cả hai đầu; định mức vật tư lấy tháng của lượt thay gần nhất trong lý lịch.
Không yêu cầu giờ đồng hồ khi lắp; theo dõi trả phiếu riêng với soạn biểu mẫu. Dữ liệu/chức năng cũ được giữ để tương thích.
Migrations bổ sung 008–009, không chạy lại foundation.
Xem [quy tắc đã chốt](docs/work-case-model.md) và [hướng dẫn](docs/personal-followup.md).
Phần mô tả Phase 3 cũ bên dưới về đồng hồ/giờ khi lắp là kiến trúc lịch sử, không phải cách tính hiện hành.

# TV-EAM – Tan Vu Equipment & Asset Management

Nguồn công khai, dữ liệu riêng tư. Không đưa hồ sơ thật, spreadsheet ID/URL riêng tư, khóa Google/Supabase hoặc ảnh hiện trường vào repository.

## Giai đoạn 3 trên nền Giai đoạn 2

Next.js App Router + TypeScript strict + Tailwind + Supabase SSR/Auth/RLS + PWA:
- Ba bảng độc lập: tổng giờ máy thực chạy tháng, số container (chiếc) tháng, hàng khác theo loại/đơn vị.
- Giờ lũy kế theo chênh lệch tháng; định mức cáp/búa khung cẩu và bảo dưỡng lấy cùng nguồn giờ, không trộn giờ hư hỏng.
- Báo cáo MTTR/MTBF/Availability, hai nhóm tồn đọng, tổng chi phí vật tư và nguyên nhân.
- QR có workspace, bắt đăng nhập và RLS; kiểm tra/báo hỏng nhanh, chuyển KT sang SC một lần.
- Hai adapter Google Sheets TH: số container nguyên (chiếc) và giờ máy thực chạy (tối đa 2 chữ số thập phân). Không có trường quy đổi; không trộn giờ dừng.
- Đọc nguồn → xem trước → kiểm tra mã → xác nhận cập nhật nguyên tử, snapshot và audit trên PostgreSQL cloud.

**Bản web chạy thử đã được triển khai** và chủ tài khoản đã tự đăng nhập vào khu vực cá nhân. Chưa nhập danh mục/số liệu thực tế hoặc kết nối Google của ứng dụng. Kiểm tra cơ sở dữ liệu không chứng minh toàn bộ luồng ghi sửa trên web với dữ liệu thật đã hoạt động. Các module CRUD sửa chữa/vật tư đầy đủ của MVP vẫn chưa có giao diện hoàn chỉnh; nền SQL đã có, không tuyên bố toàn hệ thống EAM đã hoàn thiện. Xem [ghi chú khởi tạo đám mây](docs/cloud-bootstrap.md).

## Không cài WSL2 trên máy sử dụng

Máy tính/điện thoại chỉ cần trình duyệt HTTPS; app và database chạy cloud sau khi cấp tài nguyên. CI chạy build/test trên GitHub, không cài database ở doanh nghiệp. Chưa tự tạo tài nguyên trả phí.

## Thiết lập cloud

1. Chọn Supabase project. Với DB mới áp dụng migration 001→007 theo thứ tự. Với DB đã áp dụng Giai đoạn 2, chỉ áp dụng 004→007. Không chạy foundation đè DB cũ.
2. Tạo Auth user qua Supabase; quản trị bootstrap workspace và các membership. Một cá nhân có thể giữ cả bốn vai trò. Không mở endpoint tự cấp quyền.
3. Đưa mã lên nền tảng Next.js cloud; cấu hình các biến trong .env.example bằng secret/config của môi trường, không commit file .env.
4. Nhập danh mục thiết bị và loại hàng, baseline giờ đồng hồ. Không nhập các tháng giờ đã nằm trong baseline.
5. Cho mỗi workspace toàn chi nhánh một nhóm thiết bị và nhiều người dùng, cấp quyền bằng set_member_roles của Giai đoạn 2. equipment_teams là phân nhóm, chưa phải ranh giới quyền theo đội.

### Google Sheets (không cần Publish to web)

Tài khoản Google của plugin trong chat không tự trở thành quyền Google của ứng dụng đã triển khai. Luồng app có kết nối đọc riêng:
- Chủ file cấp Viewer cho service account chỉ dùng đọc nguồn; bật Sheets API.
- GOOGLE_SHEETS_CLIENT_EMAIL / GOOGLE_SHEETS_PRIVATE_KEY chỉ nằm phía server.
- GOOGLE_SHEETS_ALLOWED_SOURCES là JSON ánh xạ workspace UUID → các spreadsheet ID được quản trị triển khai cho phép. Thiếu cấu hình thì từ chối đọc.
- Trưởng bộ phận đăng ký link nguồn trong màn hình /sheets; link lưu trong database RLS, không nằm trong mã nguồn.
- Nguồn có loại cố định container/hours. TH: hàng 3 mã thiết bị, B năm, C tháng; đăng ký nguồn cho phép nhập vùng đọc tối đa 50.000 ô, mặc định A3:BH200 (container) / A3:AR200 (giờ). Vùng rộng có giới hạn đọc thêm tháng mới mà bỏ ô trống/dòng tổng. Alias quản trị tại sheet_sources.
- Preview báo mã chưa có trong danh mục. Không tự tạo thiết bị từ bảng tính; khai báo thông tin phương tiện riêng, giờ gốc chưa biết được giữ chưa đối chiếu.
- Khi xác nhận, app đọc lại nguồn và so hash với preview; nếu đổi dữ liệu yêu cầu xem trước lại.
- Cập nhật tối đa 10.000 dòng trong một giao dịch; chunk nội bộ 1000 dòng, một dòng sai rollback tất cả.
- Luồng hiện hành chỉ nhận số container, không nhận trường TEU kể cả NULL; không có chỉ tiêu chi phí/1.000 TEU. Migration 006 giữ trường lịch sử cũ nhưng khóa thay đổi và ngừng API/view cũ. Ô trống không xóa dòng cũ; nếu cần xóa/hủy phải thực hiện thao tác được kiểm soát.
- Chỉ cập nhật khi người dùng bấm xác nhận, chưa có lịch đồng bộ tự động.
- accepted_rows trong sheet_sync_runs là snapshot đã chuẩn hóa; audit_logs giữ old/new. Đây không thay thế backup database định kỳ của nhà cung cấp.

Chưa tạo Google project/service account hay cài khóa; không gửi khóa riêng tư vào chat.

## Kiểm chứng

GitHub Actions chạy PostgreSQL 17, RLS regression, import rollback/corrections/Sheet snapshots, strict typecheck, unit tests, giải mã QR PNG và Next.js production build. Browser smoke chỉ kiểm tra shell/login khi chưa có cloud credentials, không phải end-to-end Auth thật.

## Cấu trúc

```
src/app/                 # App Router, pages, actions, API
src/components/          # Forms mobile, import previews
src/lib/                 # Typed contracts, Supabase, CSV, TH adapter
public/                  # PWA shell, không cache dữ liệu riêng tư
supabase/migrations/     # PostgreSQL, RLS, audit, reports, snapshots
tests/sql/               # Fixture và regression
tests/unit/              # Parser/time/QR decode
tests/browser/           # Smoke không dùng dữ liệu thật
docs/phase3.md            # Hợp đồng công thức, giờ, đơn vị
docs/work-case-model.md   # Mã SC/BD/VS/KT
```

Dev (chỉ dành cho người viết mã, không cần trên máy dùng app): Node>=22, npm ci, npm run dev. package-lock.json khóa cả phụ thuộc gián tiếp; CI quét npm audit ở mức moderate trở lên.

Hợp đồng container hiện tại: CSV `equipment_code,month,boxes`; ví dụ số nguyên `3382` nghĩa là 3382 chiếc, không dùng hệ số quy đổi. Bản cài đã chạy 001–005 cần áp dụng 006 cùng bản web mới; không chạy lại các migration đã áp dụng.

### Nguồn giờ hoạt động độc lập (migration 007)

- Đăng ký nguồn giờ trong /sheets, chọn tháng bắt đầu nhập. Không gộp hai file vào một nguồn.
- Số giờ ban đầu phải là giờ đồng hồ trước tháng bắt đầu. Nếu baseline hiện tại đã gồm các tháng lịch sử, cần đối chiếu/chọn tháng phù hợp trước khi nhập; hệ thống không tự đoán baseline.
- Đọc giá trị số gốc, giữ 0 khác ô trống; không cộng dòng TB/tổng hay giờ dừng.
- Preview và database kiểm tra giờ không vượt số giờ tháng lịch; chưa xác nhận kỳ chốt khác nên không mở ngoại lệ.
- Xác nhận lô yêu cầu đối chiếu baseline; app đọc lại và so hash gắn với loại nguồn, tháng bắt đầu và dữ liệu.
- sync_hours_source chỉ nhận equipment_code, month, operating_hours; từ chối trường container, sai loại nguồn, tháng trước mốc.
- Upsert theo phương tiện/tháng, cộng lũy kế theo chênh lệch, snapshot/audit cloud. Một dòng sai kể cả chunk sau rollback toàn bộ.
- Cần áp dụng 007 và bản web tương ứng. Chưa nhập dữ liệu thật vào database hay cấu hình quyền Google của app.
