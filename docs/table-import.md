# Nhập dữ liệu từ bảng

## Quy trình

Mở **Nhập dữ liệu từ bảng**, chọn đúng khu vực và nhóm dữ liệu. Tải bộ mẫu Excel, điền trang tương ứng từ dòng 2 và giữ tiêu đề cột. Chọn `.xlsx` hoặc CSV UTF-8, hoặc dán bảng có tiêu đề sao chép từ Excel. Kiểm tra lỗi tại dòng/cột, bấm **Kiểm tra và xem trước**, đối chiếu các dòng mới/thay đổi/không đổi rồi xác nhận nhập.

Mặc định **Chỉ thêm dòng mới**. Nếu tệp có mã hoặc khóa tháng đã tồn tại, phải bỏ các dòng đó khỏi tệp hoặc chọn **Thêm mới và cập nhật dòng đã có**, xác nhận đồng ý thay dữ liệu. Khi thay danh mục phương tiện, các trường tùy chọn trống sẽ xóa nội dung tương ứng của dòng đó. Các dòng không có trong tệp không bị xóa.

## Các trang trong bộ mẫu

| Trang | Cột | Khóa đối chiếu |
| --- | --- | --- |
| Phương tiện | Mã, tên, loại, trạng thái nền, số chế tạo, năm sản xuất, mã tham chiếu, ghi chú | Mã phương tiện trong khu vực |
| Vật tư | Mã vật tư, tên vật tư, đơn vị tính | Mã vật tư trong khu vực |
| Container tháng | Mã phương tiện, tháng, số container (chiếc) | Phương tiện + tháng |
| Giờ hoạt động | Mã phương tiện, tháng, giờ hoạt động | Phương tiện + tháng |
| Hàng khác tháng | Mã phương tiện, tháng, mã loại hàng, sản lượng | Phương tiện + tháng + loại hàng |
| Loại hàng | Mã loại hàng, tên loại hàng, đơn vị tính | Mã loại hàng trong khu vực |

Loại hàng là trang chuẩn bị cho bảng hàng khác; đơn vị hiện hành: tấn, m³, chiếc, chuyến. Nhập loại hàng trước khi dùng mã đó trong sản lượng. Đơn vị của vật tư/loại hàng đã có không đổi bằng nhập tệp. Danh mục vật tư không tạo tồn kho hoặc thay định mức. Danh mục phương tiện không có giờ gốc; giờ gốc/lũy kế chưa biết được giữ chưa đối chiếu.

## Kiểm soát

- 500 dòng có dữ liệu/lô; Excel tối đa 1 MiB, CSV tối đa 256 KiB; dữ liệu JSON gửi máy chủ tối đa 250 KB trước đối chiếu. Nội dung Excel giải nén bị giới hạn, chỉ đọc đúng trang tương ứng, không chạy công thức/mã hay kết nối ngoài. Tệp `.xls` cần lưu lại `.xlsx`.
- Lỗi cột, thiếu số liệu, trùng mã hoặc tháng bị chặn; không tự cộng dòng trùng, không ép ô trống thành 0. Mẫu không có dòng ví dụ hoặc phương tiện thực tế.
- Xem trước chỉ đọc dữ liệu, chưa ghi bảng hoặc ghi sổ yêu cầu. Khi nhập sẽ kiểm tra lại bản đối chiếu dưới khóa giao dịch. Nếu dòng đã thay đổi sau xem trước, từ chối cả lô để xem lại.
- Cả lô cùng một giao dịch. Sửa giờ tháng giữ cơ chế chênh lệch hiện hữu, không cộng lại tháng. Các bảng container, giờ và hàng khác vẫn độc lập; tháng trước mốc giờ bị chặn.
- API công khai chạy với quyền người gọi và RLS. Trưởng khu vực nhập phương tiện/loại hàng; cán bộ vật tư hoặc trưởng nhập vật tư; kỹ thuật viên hoặc trưởng nhập bảng tháng. Không cấp thêm quyền, không dùng thông tin người dùng tự sửa để phân quyền.
- Sổ chống gửi lại riêng tư không có quyền truy cập của khách. Hàm riêng có quyền nâng chỉ khóa các bản ghi cha trong khu vực đã kiểm tra và ghi sổ nội bộ; không ghi bảng nghiệp vụ. UUID yêu cầu + SHA-256 của nội dung/phương thức/tài khoản giúp thử lại an toàn. Các thay đổi bảng vẫn có nhật ký hiện hữu.

Áp dụng migration `bulk_table_import` trước bản web dùng chức năng này. Kiểm tra SQL trong cơ sở dữ liệu tạm và giao dịch hoàn tác trên cloud; không dùng dữ liệu sản xuất để thử ghi.
