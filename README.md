
## GIỚI THIỆU

 - Xây dựng website với tính năng đăng nhập đa nền tảng bằng tài khoản nội bộ, gmail, facebook, mail hust
 - Ảnh chụp minh họa:

Trang login:
 <img width="1917" height="875" alt="image" src="https://github.com/user-attachments/assets/59f9e663-ef75-4707-beef-c41b4968d4ae" />
Trang register:
<img width="1891" height="876" alt="image" src="https://github.com/user-attachments/assets/41573527-13a5-4fc6-8a74-e92b945585a6" />
Sau khi đăng nhập:
<img width="1900" height="872" alt="image" src="https://github.com/user-attachments/assets/099abaf0-d1e6-4da3-86e3-07ef28f2ee44" />


   

## TÁC GIẢ

- Họ và tên: Nguyễn Thị Khánh Vân
- MSSV: 20235869

## MÔI TRƯỜNG HOẠT ĐỘNG

- Client: Trình duyệt web. Người dùng tương tác với giao diện UI
- Frontend: React+Vite ( mặc định http://localhost:5173)
- Backend: Express (Nodejs) dùng TypeScript
- Database: PostgreSQL + thư viện Prisma
- Auth & Docs: xác thực JWT, tài liệu API bằng Swagger
- Hệ điều hành: Windows
- Sơ đồ tích hợp hệ thống:
```mermaid
flowchart LR
    %% Client & Frontend
    Browser["Client (Trình duyệt Web)"] -->|1. Tương tác UI| ViteDev["Frontend: React + Vite\n(Port 5173)"]
    
    %% Frontend to Backend via Proxy
    ViteDev -->|2. Gọi API qua Axios Proxy /api| Express["Backend: Express\n(Node.js + TypeScript)"]
    
    %% Backend Integrations
    subgraph ThirdParty ["Hệ thống Xác thực bên thứ 3 (OAuth2 & API)"]
        Google["Google Auth\n(OAuth2 Client)"]
        Facebook["Facebook Graph API"]
        ToolHub["API ToolHub\n(Cổng xác thực HUST)"]
    end

    Express <-->|3a. Xác thực Token / Kiểm tra mật khẩu| ThirdParty
    
    %% Backend to Database & Docs
    subgraph DataAndDocs ["Dữ liệu & Tài liệu"]
        Postgres[(Database:\nPostgreSQL)]
        Swagger["Auth & Docs:\nJWT + Swagger UI"]
    end

    Express -->|3b. Ánh xạ 1-1 & Lưu trữ| Postgres
    Express -->|4. Sinh tài liệu API| Swagger

```

  
## HƯỚNG DẪN CÀI ĐẶT VÀ CHẠY THỬ

### Yêu cầu hệ thống
- Nodejs (v18 hoặc v20)
- PostgreSQL
- Git
### Các bước cài đặt
#### Backend
- Bước 1: Fork và Clone mã nguồn về máy
- Bước 2: Di chuyển vào backend và cài đặt các thư viện cần thiết
```bash
cd backend
npm install
```
- Bước 3: tạo .env trong thư mục backend và cấu hình các biến môi trường
```bash
# Kết nối Database PostgreSQL
DATABASE_URL="postgresql://postgres:mat_khau_db@localhost:5432/ten_db_cua_ban?schema=public"

# Cấu hình JWT và OAuth2
JWT_SECRET="bi_mat_quan_trong_khong_tiet_lo"
GOOGLE_CLIENT_ID="your_google_client_id.apps.googleusercontent.com"

# Cổng API xác thực HUST (ToolHub)
HUST_AUTH_API_URL="https://api.example.com/hust-auth"
```
- Bước 4: Đồng bộ Databse với Prisma
```bash
# Đồng bộ trực tiếp cấu trúc Schema hiện tại xuống Database
npx prisma db push
# Khởi tạo/Cập nhật Prisma Client để mã nguồn có thể tương tác được với Database
npx prisma generate
```
- Bước 5: Khởi chạy Backend
```bash
npm run dev
```
Sau khi backend chạy tại http://localhost:3000
tài liệu API có thể truy cập tại http://localhost:3000/api-docs
#### Frontend
Bước 1: Di chuyển sang thư mục frontend và cài đặt:
```bash
cd ../frontend
npm install
```
- Bước 2: Tạo .env nằm trong thư mục frontend
```bash
VITE_GOOGLE_CLIENT_ID="your_google_client_id.apps.googleusercontent.com"
VITE_FB_APP_ID=
```
- Bước 3: chạy
```bash
npm run dev
```
Frontend của sẽ chạy mặc định tại địa chỉ: http://localhost:5173
### Kiểm tra
- Mở http://localhost:5173 trong trình duyệt và thử đăng ký/đăng nhập
- Hoặc mở Swagger: http://localhost:3000/api-docs để thử API
## NGUYÊN LÝ CƠ BẢN

> Tham khảo cách trình bày như ở đây [Code Project](https://www.codeproject.com/Articles/5385907/Managing-Cplusplus-Projects-with-Conan-and-CMake)

### TÍCH HỢP HỆ THỐNG

- Mô tả các thành phần phần cứng và vai trò của chúng: máy chủ, máy trạm, thiết bị IoT, MQTT Server, module cảm biến IoT...
- Mô tả các thành phần phần mềm và vai trò của chúng, vị trí nằm trên phần cứng nào: Front-end, Back-end, Worker, Middleware...

> Nên sử dụng cú pháp mermaid trong markdown, cho phép từ text sinh ra đồ thị. Như vậy dễ hiệu chỉnh. Ví dụ, hoặc [có thể sửa online rồi copy vào tài liệu](https://mermaid.live/edit#pako:eNqFkrFOwzAQhl_FugmktmqbNC0ZEIgyMCAhJISEsrjJtbHU2MGxRUuVmZkHYGFjQDxAx_IifROuaQItFNWTff7-_-7sm0GoIgQfMry3KEPsCz7SPAkkKxe3RkmbDFBvxEKjNDuX0U22GU65NiIUKZeG3eLgGon79_b06uJkxgIw0xQD8GkXKmm0GgfA8t2qPjd8wDP8pYvK8LawrK5-fFyV4rMwVmyCCft8Fj9gdV0ntBStyOX8hZnFOztItUpEhoc7FIU3NVI6C8mi5fyDjcVy_mS3eIKIrhrYw1dYfSPBBkjlL16nf-y3Oi0QJuPF255GH3CwhqEGIy0i8Id8nGENEtQJX51htrKgB48xqV4ch9yOTQCBzElHn3OnVAK-0ZaUWtlRXB1sSt9TTdU3gTJCfaasNOB3CgPwZzAB32m2Gi2PluM1nbbnujWYUtRreG33qOd22r2u1207eQ0ei4zNRq9LBhgJmsjL9SgXE51_AYzG7q0)
```mermaid
sequenceDiagram
        autonumber
        actor EndUser
        participant WebReact
        participant WebAPI@{ "type": "control" }
        participant Database@{ "type": "database" }
        EndUser->>WebReact: cho xem đi
        WebReact-->>EndUser: chờ tí (promise)
        WebReact->>WebAPI: cho xin dữ liệu
        WebAPI->>Database: cho xin dữ liệu
        Database-->>WebAPI: dữ liệu đây
        WebAPI-->>WebReact: đây nhé
        WebReact-->>EndUser: web đây
```

### CÁC THUẬT TOÁN CƠ BẢN
- Băm mật khẩu bằng bcryptjs
```mermaid
flowchart TD
    A["User nhập mật khẩu thô\n(plain_password)"] --> B{"Kiểm tra dữ liệu đầu vào\n(password không rỗng?)"}
    
    B -->|Không hợp lệ| C["Trả lỗi 400:\nThiếu mật khẩu"]
    B -->|Hợp lệ| D["Tạo hash bằng bcryptjs\nbcrypt.hash(password, 10)"]
    
    D --> E["Lưu hashed password vào DB\n(Tuyệt đối không lưu mật khẩu thô)"]
    E --> F["Hoàn tất đăng ký"]
    
    C --> Z([End])
    F --> Z
```
- Tạo JWT token
```mermaid
flowchart TD
    A["Người dùng đã xác thực thành công"] --> B["Lấy thông tin user từ DB"]
    B --> C["Trích xuất permissions từ role\nuser.role.permissions"]
    C --> D["Tạo payload JWT\n{ userId, role, permissions }"]
    D --> E["Ký token bằng JWT_SECRET\njwt.sign(payload, JWT_SECRET, { expiresIn: '1h' })"]
    E --> F["Trả về access token cho client"]
    F --> G["Client lưu token và dùng cho các request sau"]
```
- Đăng ký:
```mermaid
flowchart TD
    A["User nhập:\nemail, username, password"] --> B{"Kiểm tra email\nđã tồn tại trong DB?"}
    
    B -->|Đã tồn tại| C["Throw Error:\n'Email đã được sử dụng'"]
    B -->|Chưa tồn tại| D["Băm mật khẩu\n(bcryptjs hash 10)"]
    
    D --> E["Tạo User mới (Prisma)\nrole_id = 2"]
    
    E --> F["Trả về thông tin User\n{ id, email, username, role_id }"]
    
    C --> G([End])
    F --> G
```
- Đăng nhập
```mermaid
flowchart TD
    A["User nhập:\nemail, password"] --> B["Tìm user theo email"]
    B -->|Không tìm thấy| C["HTTP 401:\nEmail không tồn tại"]
    B -->|Tìm thấy| D["So sánh password\nbcryptjs.compare\ninput_password với hashed_password"]
    D -->|Không khớp| E["HTTP 401:\nMật khẩu sai"]
    D -->|Khớp| F["Lấy role & permissions\nSELECT role, permissions FROM user"]
    F --> G["Tạo JWT Token\npayload: userId, role, permissions\nexpiresIn: 1h\nsigned with JWT_SECRET"]
    G --> H["HTTP 200\n{ token, user { id, email, username, role, permissions } }"]
    C --> Z([End])
    E --> Z
    H --> Z
```
- Đăng nhập bằng Google
```mermaid
flowchart TD
    A["User click 'Login with Google'\nFrontend nhận Google ID token"] --> B["POST /api/auth/google\n{ token }"]
    B --> C["Verify ID token\nGoogleAuthClient.verifyIdToken"]
    C -->|Invalid| D["HTTP 401:\nInvalid Google token"]
    C -->|Valid| E["Trích xuất\ngoogle_id = payload.sub\nemail = payload.email"]
    E --> F["Tìm theo google_id"]
    F -->|Tìm thấy| G["User tồn tại\nDùng user này"]
    F -->|Không tìm thấy| H["Tìm theo email"]
    H -->|Tìm thấy| I["Account Linking\nUPDATE user\nSET google_id = provider_id"]
    H -->|Không tìm thấy| J["Tạo User mới\nINSERT user\nemail, google_id, username"]
    I --> K["Tạo JWT"]
    J --> K
    G --> K
    K --> L["HTTP 200\n{ token, user }"]
    D --> Z([End])
    L --> Z
```
- Đăng nhập bằng Facebook
```mermaid
flowchart TD
    A["User click 'Login with Facebook'\nFrontend nhận access token"] --> B["POST /api/auth/facebook\n{ token }"]
    B --> C["Verify Access Token\nGọi Facebook Graph API\nGET /me?fields=id,name,email"]
    C -->|Lỗi/Không email| D["HTTP 401:\nInvalid Facebook token\nhoặc thiếu email"]
    C -->|Valid| E["Trích xuất\nfacebook_id = fbData.id\nemail = fbData.email\nname = fbData.name"]
    E --> F["Tìm theo facebook_id"]
    F -->|Tìm thấy| G["User tồn tại"]
    F -->|Không tìm thấy| H["Tìm theo email"]
    H -->|Tìm thấy| I["Account Linking\nUPDATE user\nSET facebook_id = provider_id"]
    H -->|Không tìm thấy| J["Tạo User mới\nINSERT user"]
    I --> K["Tạo JWT"]
    J --> K
    G --> K
    K --> L["HTTP 200\n{ token, user }"]
    D --> Z([End])
    L --> Z
```
- Đăng nhập bằng tài khoản Hust
```mermaid
flowchart TD
    A["User nhập\ntaikhoan (HUST ID), matkhau"] --> B["POST /api/auth/hust\n{ taikhoan, matkhau }"]
    B --> C["Verify HUST Account\nGọi HUST Auth API\nGET ?taikhoan=...&matkhau=..."]
    C -->|Kết quả != 1| D["HTTP 401:\nTài khoản/mật khẩu HUST sai"]
    C -->|Kết quả = 1| E["Trích xuất\nhust_id = taikhoan\nemail = taikhoan (nếu email)"]
    E --> F["Tìm theo hust_id"]
    F -->|Tìm thấy| G["User tồn tại"]
    F -->|Không tìm thấy| H["Tìm theo email"]
    H -->|Tìm thấy| I["Account Linking\nUPDATE user\nSET hust_id = provider_id"]
    H -->|Không tìm thấy| J["Tạo User mới\nINSERT user\nhust_id, email"]
    I --> K["Tạo JWT"]
    J --> K
    G --> K
    K --> L["HTTP 200\n{ token, user }"]
    D --> Z([End])
    L --> Z
```
- Xác thực token và phân quyền
```mermaid
flowchart TD
    A["Request tới endpoint bảo vệ\nHeader: Authorization: Bearer <token>"] --> B{"Trích xuất token\n(split 'Bearer ')"}
    
    B -->|Không có token| C["HTTP 401:\nBạn chưa đăng nhập (Thiếu Token)"]
    B -->|Có token| D{"Verify JWT\njwt.verify(token, JWT_SECRET)"}
    
    D -->|Lỗi / Hết hạn| E["HTTP 403:\nToken không hợp lệ hoặc đã hết hạn"]
    D -->|Hợp lệ| F["Giải mã Token\nGắn payload vào req.user\n{ userId, role, permissions }"]
    
    F --> G{"Kiểm tra Permission\nuserPermissions.includes(permission)?"}
    
    G -->|Không có quyền| H["HTTP 403:\nBạn không có quyền truy cập"]
    G -->|Có quyền| I["Cho phép (next)\nĐi tiếp vào Controller"]
    
    C --> Z([End])
    E --> Z
    H --> Z
    I --> Z
```
> Nên sử dụng cú pháp mermaid trong markdown, cho phép từ text sinh ra đồ thị. Như vậy dễ hiệu chỉnh. Ví dụ, hoặc [có thể sửa online rồi copy vào tài liệu](https://www.mermaidchart.com/play?utm_source=mermaid_live_editor&utm_medium=share#pako:eNqrVkrOT0lVslJKy8kvT85ILCpRCHGJyVMAAsfokMOr8hRyMx_ubsyLVdDVtaspyXy4a39BjYKThu_hhZUKyRkPdy_XhKh2AilQcK4OT00qzixJrYWIOoO1-eel1ii4RLsV5eeV6KbmpSikJVqlJeqmVqbGIisLKc-vUXCNdkpMzkZSVZxaVJZaBFSoVAsA0_I7vg)

```mermaid
flowchart TD
    A[Tên miền] -->|tiếp| B(Máy chủ)
    B --> C{Website}
    C -->|One| D[Front-end fa:fa-eye]
    C -->|Two| E[Back-end fa:fa-server]

```


### THIẾT KẾ CƠ SỞ DỮ LIỆU

- Sơ đồ quan hệ thực thể thể hiện mối quan hệ giữa các trường thông tin.

> Nên sử dụng cú pháp mermaid trong markdown, cho phép từ text sinh ra đồ thị. Như vậy dễ hiệu chỉnh. Ví dụ, hoặc [có thể sửa online rồi copy vào tài liệu](https://mermaidchart.com/play?utm_source=mermaid_live_editor&utm_medium=share#pako:eNqdUsGKwjAQ_ZUw5yra1qq5qoc9iIurl6WwhCatgTbpphNYt_rvm7ZWlIKHndPM4-XNy2NqSDQXQEGYtWSZYUWsiKvV8eOw22725HIZjXRNdvu1Gygpc5aIquN0WEO43Ahfb4fN1rESrZBJdeO973fr4-rwJNUzpUpyy3vF-9a6m5uq0EiVEckHkGKFGICiYDLv0OujzdeKnKEg2nCXgusG1AoZ2upJtf_UP5ymuWZISiMTMTTaBfOgKhWSb8sUSjy_0gAPMiM50JTllfCgEMZF4WZoxWLAk3AugLqWi5TZHGOIVfOuZOpT6wIoGuteGm2zUz_Yssnmdht3hlAuqpW2CoEuWwGgNfwADSbT8TRyFUSTwI_C0IOzQ6Nx5IfLRTjzF_No7gdXD37bjZPxYj7zQHCJ2my7U2wv8voHm3HFLQ) 

```mermaid
erDiagram

    User {
        Int id PK
        String username
        String password
        String email UK
        String google_id UK
        String facebook_id UK
        String hust_id UK
        DateTime created_date
        DateTime updated_date
        Int role_id FK
    }

    Role {
        Int id PK
        String role_name
    }

    Permission {
        Int id PK
        Int role_id FK
        String permission_name
    }

    Post {
        Int id PK
        Int user_id FK
        DateTime created_date
        DateTime updated_date
        Int total_point
        String content
        String image
        DateTime expired_time
        String tag_list
    }

    Category {
        Int id PK
        String category_name UK
    }

    CatePost {
        Int post_id PK, FK
        Int category_id PK, FK
    }

    Vote {
        Int id PK
        Int post_id FK
        String tag_name
        Int point
        Int user_id FK
    }

    Role ||--o{ User : has
    Role ||--o{ Permission : grants

    User ||--o{ Post : creates
    User ||--o{ Vote : gives

    Post ||--o{ Vote : receives

    Post ||--o{ CatePost : categorized
    Category ||--o{ CatePost : contains
```
- Giải thích các table, và một vài table.field quan trọng
```prisma
// File: backend/prisma/schema.prisma

generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
}

model User {
  id           Int      @id @default(autoincrement())
  username     String
  password     String
  email        String   @unique
  google_id    String?  @unique
  facebook_id  String?  @unique
  hust_id      String?  @unique
  created_date DateTime @default(now())
  updated_date DateTime @updatedAt
  role_id      Int
  posts        Post[]
  role         Role     @relation(fields: [role_id], references: [id])
  vote         Vote[]
}

model Role {
  id          Int          @id @default(autoincrement())
  role_name   String
  permissions Permission[]
  users       User[]
}

model Permission {
  id              Int    @id @default(autoincrement())
  role_id         Int
  permission_name String
  role            Role   @relation(fields: [role_id], references: [id])
}
```
 #### Bảng **USER**
| Cột | Kiểu | Ràng buộc | Mô tả |
|-----|------|----------|--------|
| `id` | INT | PK, AUTO_INCREMENT | ID nội bộ duy nhất |
| `username` | VARCHAR | NOT NULL | Tên hiển thị |
| `password` | VARCHAR | NOT NULL | Mật khẩu đã băm bằng bcrypt |
| `email` | VARCHAR | UNIQUE, NOT NULL | Email để đăng ký & đăng nhập form |
| `google_id` | VARCHAR | UNIQUE, NULLABLE | Google subject ID |
| `facebook_id` | VARCHAR | UNIQUE, NULLABLE | Facebook user ID |
| `hust_id` | VARCHAR | UNIQUE, NULLABLE | Mã đăng nhập HUST |
| `created_date` | TIMESTAMP | DEFAULT NOW() | Thời gian tạo account |
| `updated_date` | TIMESTAMP | DEFAULT NOW() | Thời gian cập nhật cuối |
| `role_id` | INT | FK (ROLE.id) | Tham chiếu vai trò |

#### Bảng **ROLE**
| Cột | Kiểu | Ràng buộc | Mô tả |
|-----|------|----------|--------|
| `id` | INT | PK, AUTO_INCREMENT | ID vai trò |
| `role_name` | VARCHAR | NOT NULL | Tên vai trò (USER, ADMIN, GUEST) |

#### Bảng **PERMISSION**
| Cột | Kiểu | Ràng buộc | Mô tả |
|-----|------|----------|--------|
| `id` | INT | PK, AUTO_INCREMENT | ID quyền |
| `role_id` | INT | FK (ROLE.id), NOT NULL | Tham chiếu vai trò |
| `permission_name` | VARCHAR | NOT NULL | Tên quyền (POST_CREATE, USER_VIEW, ...) |
- Cấu trúc **File:** `backend/.env`
   - DATABASE_URL
   - JWT_SECRET
   - GOOGLE_CLIENT_ID
   - HUST_AUTH_API_URL
- Cấu trúc **File:** `frontend/.env`
   - VITE_GOOGLE_CLIENT_ID
   - VITE_FB_APP_ID
### CÁC PAYLOAD

- Cấu trúc các gói json
- Nội dung trao đổi giữa các module, cảm biến

 > Trường hợp thiết kế web-api và có swagger, có thể chụp screenshot vài bức ảnh từ swagger ra, dán trực tiếp vào giao diện soạn thảo trên GitHub
 <img width="1060" height="449" alt="image" src="https://github.com/user-attachments/assets/8b75294a-9091-4d41-86f8-fbce03fceac2" />


### ĐẶC TẢ HÀM

- Một số hàm quan trọng
- Mô tả ý nghĩa của hàm, tham số vào, ra
- Hoặc có thể tham chiếu, chụp ảnh từ các công cụ như swagger, pydoc, javadoc, doxygen

  ```C
     /**
      *  Hàm tính ...
      *  @param  x  Tham số
      *  @param  y  Tham số
      */
     void abc(int x, int y = 2);
  ```

 > Trường hợp thiết kế web-api và có swagger, có thể chụp screenshot vài bức ảnh từ swagger ra, dán trực tiếp vào giao diện soạn thảo trên GitHub
 <img width="1060" height="449" alt="image" src="https://github.com/user-attachments/assets/8b75294a-9091-4d41-86f8-fbce03fceac2" />


### PHÁT SINH

_Các sự cố, vẫn đề, lỗi mà không xử lý được, hoặc xử lý mất quá 4h thì nên ghi vào đây, hoặc ghi vào [issue của GitHub](https://github.com/neittien0110/ProjectSample/issues). Sẽ được tính điểm. Ví dụ__

- __Lỗi: blablablabla__
  - Chi tiêt: .....
  - Nguyên nhân: ...
  - Giải pháp: chưa có

  
## KẾT QUẢ
https://drive.google.com/file/d/17SNAGalhQkKYkPofUxaavpbRJMLn5de1/view?usp=sharing
