# Ranh giới định danh (Auth) của Medicine backend

Thư mục này đánh dấu chỗ sẽ tích hợp định danh từ **Auth backend hiện có** (`backend/`).
Ở M1 thư mục chỉ có tài liệu này; **không có code xác thực nào**.

## M1 không làm gì

- Không xác thực token, không quản lý phiên, không đăng nhập, đăng xuất hay refresh.
- Không có người dùng giả hay định danh mặc định.
- Không truy cập database của Auth (bảng `User`, `Role`, `Permission`, `RefreshToken`...).
- Không dùng bảng `Account` legacy trong database Medicine để xác thực.
- Không có phân quyền nghiệp vụ, tên quyền hay bảng ánh xạ vai trò.

Endpoint duy nhất của M1 là `GET /api/medicine/status`. Endpoint này không chứa dữ liệu nghiệp vụ nên không cần đăng nhập.
Ngoại lệ này **không** áp dụng cho bất kỳ endpoint nghiệp vụ nào sau này.

## Trách nhiệm

| Phần | Chịu trách nhiệm |
| --- | --- |
| Tài khoản, mật khẩu, đăng nhập, phiên, access/refresh token, đăng xuất | Auth backend |
| Kiểm tra định danh của request gửi tới Medicine, chặn thao tác không được phép | Medicine (từ M2, qua module trong thư mục này) |
| Dữ liệu y tế, truy vấn, xuất Excel | Medicine |

## Khi bắt đầu M2

Trước khi viết code trong thư mục này, phải kiểm tra lại **hợp đồng thực tế** của Auth (task T013), không tự nghĩ ra giao thức.
Những gì Auth đang cung cấp tại thời điểm viết tài liệu này (cần xác minh lại ở M2):

- Access token là JWT ký HS256 bằng `JWT_SECRET`, hạn 15 phút, gửi qua header `Authorization: Bearer`.
- Claims hiện có: `userId`, `role`, `permissions`. Đây là ảnh chụp quyền tại lúc đăng nhập, không phải quyền hiện tại.
- Refresh/logout do Auth xử lý (`/api/auth/refresh`, `/api/auth/logout`); Medicine không làm lại các chức năng này.
- Chưa có endpoint introspection hay kiểm tra quyền hiện tại phía Auth.

Các câu hỏi M2 phải trả lời trước khi bảo vệ dữ liệu nghiệp vụ:

1. Medicine xác minh token bằng cách nào: tự kiểm tra chữ ký bằng khoá được cấu hình (thuật toán cố định, kiểm tra hạn), hay hỏi Auth. Chỉ decode token mà không kiểm tra chữ ký thì không được chấp nhận.
2. Nếu dùng chung `JWT_SECRET` (HS256), Medicine cũng có khả năng tự ký token. Cần quyết định có chấp nhận điều này không.
3. Quyết định cho phép/từ chối từng thao tác nghiệp vụ lấy từ đâu. Không suy ra quyền Medicine từ tên vai trò của Auth.
4. Khi Auth không khả dụng thì xử lý thế nào. Không xác minh được thì phải từ chối (fail closed).

Cấu hình xác minh (nếu có) phải được cung cấp từ bên ngoài, không có giá trị mặc định, và không được log hay trả về client.
