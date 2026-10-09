# TV-EAM – Tan Vu Equipment & Asset Management

Repository nguồn công khai; tuyệt đối không đưa khóa Supabase, dữ liệu thật, hồ sơ doanh nghiệp hoặc ảnh hiện trường vào Git.

## Tình trạng

Đây là nền tảng cơ sở dữ liệu Giai đoạn 2 trên một nhánh phát triển, **chưa phải ứng dụng Next.js/PWA hoàn thiện hay bản triển khai sử dụng thật**. Repository ban đầu chưa có mã MVP để nâng cấp; các migration này dành cho database Supabase mới, không chạy đè database đang có dữ liệu.

- Danh mục thiết bị / thông số, hồ sơ nhiều hạng mục, bốn nội dung kỹ thuật và sáu tiến độ độc lập.
- Vụ việc SC / BD / VS / KT, ngày giờ thực tế và chống gửi trùng.
- Sản lượng và giờ tháng, import nguyên tử, điều chỉnh lũy kế theo chênh lệch.
- Kế hoạch bảo dưỡng theo ngày/giờ, kiểm tra đầu ca chuyển hồ sơ sửa chữa.
- Danh mục vật tư, bút toán kho có chống âm tồn và chống gửi trùng.
- Hồ sơ kỹ thuật với bucket riêng tư, RLS theo tài liệu.
- RBAC/RLS, bảo vệ trường nghiệm thu/đóng hồ sơ, audit old/new.
- Views lịch sử, cảnh báo bảo dưỡng, tổng hợp tháng và tồn kho.

## Kiểm chứng

GitHub Actions chạy PostgreSQL 17 độc lập, tạo fixture Auth/Storage tối thiểu rồi áp dụng migration và kiểm thử. Fixture chỉ mô phỏng DB API; **không thay thế kiểm thử đăng nhập, upload thực tế và giao diện trên Supabase**.

Chạy CI PostgreSQL không cần WSL2, Docker hay cài database vào máy cá nhân. Xem kết quả trên tab Actions của repository. Không áp dụng file `tests/sql/fixture.sql` vào Supabase.

## Triển khai dữ liệu sau khi duyệt

1. Chọn/tạo dự án Supabase cloud và kiểm tra chi phí trước khi xác nhận.
2. Sao lưu dữ liệu nếu có. Không áp dụng foundation này lên schema cũ.
3. Áp dụng lần lượt `supabase/migrations/*.sql`.
4. Tạo tài khoản qua Supabase Auth. Owner dự án bootstrap workspace và vai trò bằng SQL quản trị, không mở API tự nâng quyền.
5. Giai đoạn tiếp theo nối Next.js SSR/Auth/PWA, form nghiệp vụ và kiểm thử đầu-cuối.

SQL bootstrap quản trị (thay UUID, không dùng giá trị mẫu):

```sql
begin;
insert into public.workspaces(id,name) values ('<WORKSPACE_UUID>','TV-EAM cá nhân');
insert into public.workspace_memberships(workspace_id,user_id,role)
select '<WORKSPACE_UUID>'::uuid,'<AUTH_USER_UUID>'::uuid,unnest(enum_range(null::public.eam_role));
commit;
```

Một cá nhân có thể giữ bốn vai trò. Dữ liệu thuộc workspace; thành viên khác không được đọc/ghi nếu chưa được cấp quyền. Khóa service role chỉ dùng quản trị tin cậy, không đưa vào trình duyệt.

## Cấu trúc

```
docs/work-case-model.md
supabase/migrations/
tests/sql/fixture.sql
tests/sql/regression.sql
.github/workflows/database.yml
```

Xem [quy tắc mã vụ việc](docs/work-case-model.md). Nguyên tắc lý lịch: truy vấn nguồn nghiệp vụ qua SQL view, không nhập lại lịch sử.
