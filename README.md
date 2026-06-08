
## GIỚI THIỆU

 Auth-System ra đời để xóa bỏ sự phiền toái đó. Thay vì để người dùng loay hoay với hàng tá tài khoản và thông tin phân mảnh, dự án xây dựng một 'Trạm định danh thông minh'. Hệ thống cho phép người dùng đăng nhập tức thì thông qua Google, Facebook hay tài khoản Bách Khoa (HUST) chỉ với một cú click. Quan trọng hơn, công nghệ ánh xạ định danh của chúng tôi sẽ tự động quy tụ mọi danh tính rời rạc về một hồ sơ người dùng duy nhất, mang lại trải nghiệm liền mạch và nhất quán
 - Ảnh chụp minh họa:

Trang login:\
![trang dang nhap](https://github.com/user-attachments/assets/59f9e663-ef75-4707-beef-c41b4968d4ae)
Trang register:\
![trang dang ky](https://github.com/user-attachments/assets/41573527-13a5-4fc6-8a74-e92b945585a6)
Sau khi đăng nhập:\
![trang dang nhap_thanh_cong](https://github.com/user-attachments/assets/099abaf0-d1e6-4da3-86e3-07ef28f2ee44)


   

## TÁC GIẢ

- Họ và tên: Nguyễn Thị Khánh Vân
- MSSV: 20235869
- Email: nguyenvan2005ty@gmail.com

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
# Đồng bộ trực tiếp cấu trúc Schema hiện tại lên Database
npx prisma db push
# Khởi tạo/Cập nhật Prisma Client để mã nguồn có thể tương tác được với Database
npx prisma generate
```
- Bước 5: Khởi chạy Backend
```bash
npm run build
npm run start
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
npm run build
npm run start
```
Frontend của sẽ chạy mặc định tại địa chỉ: http://localhost:5173
### Kiểm tra
- Mở http://localhost:5173 trong trình duyệt và thử đăng ký/đăng nhập
- Hoặc mở Swagger: http://localhost:3000/api-docs để thử API
## NGUYÊN LÝ CƠ BẢN

### TÍCH HỢP HỆ THỐNG

#### Sơ đồ hệ thống
```mermaid
flowchart TB
 subgraph subGraph0["Client Layer"]
        Browser["Web Browser<br>(React + Vite)<br>port: 5173"]
  end
 subgraph Frontend["Frontend"]
        ReactApp["React Application<br>- AuthForm.tsx<br>- LoginForm.tsx<br>- RegisterForm.tsx"]
        AxiosClient["Axios Client<br>baseURL: /api<br>Authorization Header"]
  end
 subgraph Network["Network"]
        Proxy["Vite Proxy<br>/api -&gt; localhost:3000"]
  end
 subgraph subGraph3["Backend Services"]
        ExpressApp["Express.js Server<br>port: 3000"]
        AuthRoute["Auth Routes<br>/api/auth/register<br>/api/auth/login<br>/api/auth/google<br>/api/auth/facebook<br>/api/auth/hust"]
        AuthMiddleware["Auth Middleware<br>- verifyToken<br>- checkPermission"]
        AuthService["Auth Service<br>- registerUser<br>- loginUser<br>- googleLoginUser<br>- facebookLoginUser<br>- hustLoginUser"]
  end
 subgraph subGraph4["Database Layer"]
        PostgreSQL["PostgreSQL Database<br>- Users<br>- Roles<br>- Permissions"]
  end
 subgraph subGraph5["External Services"]
        GoogleAuth["Google OAuth 2.0<br>verify ID Token"]
        FacebookAPI["Facebook Graph API<br>verify Access Token"]
        HUSTAuth["HUST Auth API<br>taikhoan/matkhau"]
  end
    Browser -- HTTP Request --> Proxy
    Proxy -- axios --> AxiosClient
    AxiosClient -- HTTP(S) --> ExpressApp
    ReactApp --> AxiosClient
    ExpressApp --> AuthRoute
    AuthRoute -- verify & check --> AuthMiddleware
    AuthRoute --> AuthService
    AuthService -- Prisma Client --> PostgreSQL
    AuthService -- verify --> GoogleAuth & FacebookAPI & HUSTAuth

     Browser:::frontend
     ReactApp:::frontend
     AxiosClient:::frontend
     Proxy:::frontend
     ExpressApp:::backend
     AuthRoute:::backend
     AuthMiddleware:::backend
     AuthService:::backend
     PostgreSQL:::db
     GoogleAuth:::external
     FacebookAPI:::external
     HUSTAuth:::external
    classDef frontend fill:#e1f5ff,stroke:#01579b,stroke-width:2px
    classDef backend fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef db fill:#fce4ec,stroke:#880e4f,stroke-width:2px
    classDef external fill:#fff3e0,stroke:#e65100,stroke-width:2px
```

#### Luồng hoạt động
```mermaid
sequenceDiagram
	participant User as User
	participant UI as React App
	participant Client as authApi/axiosClient
	participant Proxy as Vite Proxy
	participant API as Express API
	participant Service as Auth Service
	participant DB as PostgreSQL

	User->>UI: Nhập email/password hoặc chọn Google/Facebook/HUST
	UI->>Client: Gửi submit login/register
	Client->>Proxy: POST /api/auth/*
	Proxy->>API: Forward request
	API->>Service: Xử lý xác thực
	Service->>DB: Tìm/ghi user, role, permissions
	DB-->>Service: Trả dữ liệu
	Service-->>API: Trả token + user
	API-->>Client: HTTP 200
	Client-->>UI: Trả response
	UI->>User: Lưu token/user vào localStorage và chuyển sang /profile

	Note over Client: Các request sau sẽ tự gắn Authorization: Bearer <token>
	UI->>Client: Gửi request tới endpoint bảo vệ
	Client->>Proxy: Request kèm token
	Proxy->>API: Forward request
	API->>Service: verifyToken + checkPermission
	Service->>DB: Đọc/kiểm tra quyền nếu cần
	Service-->>API: Cho phép hoặc từ chối
	API-->>Client: HTTP 200/401/403
	Client-->>UI: Trả kết quả
 ```
| Thành phần | Vai trò |
|---|---|
| Front-end | Hiển thị giao diện cho người dùng, nhận dữ liệu nhập vào, gọi API đăng nhập hoặc đăng ký, lưu token sau khi login thành công |
| Back-end | Nhận request từ frontend, xử lý đăng nhập, đăng ký, xác thực token, kiểm tra quyền và trả dữ liệu về |
| Middleware | Đứng giữa request và controller để kiểm tra trước khi xử lý, ví dụ `verifyToken` và `checkPermission` |

### CÁC THUẬT TOÁN CƠ BẢN
- Băm mật khẩu bằng bcryptjs\
    Chuỗi kết quả sau khi băm thường có độ dài 60 ký tự, tuân theo cấu trúc chuẩn gồm 3 phần được phân tách bằng dấu $:
  - Phần 1 (Phiên bản): Xác định phiên bản của thuật toán bcrypt đang sử dụng: `$2b$`
  - Phần 2 (Cost Factor): Thể hiện số vòng lặp băm theo lũy thừa của 2. (Ví dụ: `10` nghĩa là 1024 vòng lặp). Số này càng lớn, thuật toán chạy càng chậm và càng an toàn
  - Phần 3 (Salt & Hash): Gồm 22 ký tự đầu là chuỗi salt (được thêm ngẫu nhiên vào mật khẩu) và phần còn lại là chuỗi mật khẩu đã băm

  Vì vậy, mỗi lần gọi `bcrypt.hash(password, 10)` thì bcrypt tự sinh salt mới, nên hash đầy đủ vẫn khác nhau ngay cả khi mật khẩu nhập vào giống nhau.
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


### THIẾT KẾ CƠ SỞ DỮ LIỆU

- Sơ đồ quan hệ thực thể thể hiện mối quan hệ giữa các trường thông tin.

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
![](https://github.com/user-attachments/assets/163bfefc-48fe-4e52-93eb-6e2ca8944934)

![](https://github.com/user-attachments/assets/58e35050-8179-4b7e-8a7d-a09f8513a399)

![](https://github.com/user-attachments/assets/0309c020-1b8b-48b3-845b-434320d33ed5)

![](https://github.com/user-attachments/assets/3a758e07-94c3-4ee6-bef7-2b810f672529)

![](https://github.com/user-attachments/assets/72333dd1-4b52-4efc-adb4-6aee52cd2de9)


### ĐẶC TẢ HÀM

- #### Auth Services
**`registerUser`**

```typescript
export const registerUser = async (userData: any) => {
  if (!userData?.email || !userData?.username || !userData?.password) {
    throw new Error('Thiếu email, username hoặc password');
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: userData.email },
    select: { id: true },
  });

  if (existingUser) {
    throw new Error('Email đã được sử dụng');
  }

  // 1. Băm mật khẩu
  const hashedPassword = await bcrypt.hash(userData.password, 10);
  
  // 2. Lưu vào DB (Giả sử bạn đã có bảng User trong schema.prisma)
  try {
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        username: userData.username,
        password: hashedPassword,
        role_id: 2
      },
      select: {
        id: true,
        email: true,
        username: true,
        role_id: true
      }
    });
    return user;
  } catch (error: any) {
    if (error?.code === 'P2002') {
      throw new Error('Email đã được sử dụng');
    }

    throw error;
  }
};
```

**Mô tả:** Tạo tài khoản người dùng mới với email, username, và mật khẩu.

**Tham số:**
| Tham số | Kiểu | Mô tả |
|--------|------|--------|
| `userData` | Object | Chứa `email`, `username`, `password` |
| `userData.email` | string | Email đăng ký (duy nhất) |
| `userData.username` | string | Tên hiển thị |
| `userData.password` | string | Mật khẩu plain text (sẽ được hash) |

**Giá trị trả về:**
```typescript
{
	id: number,
	email: string,
	username: string,
	role_id: number
}
```

**`loginUser`**

```typescript
export const loginUser = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({ 
    where: {email},
    include: {
      role: {
        include: {
          permissions: true
        }
      }
    }
  });

  if (!user) throw new Error('Email không tồn tại');

  //kiem tra mat khau
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new Error('Mật khẩu sai');

  const { token, permissions } = generateToken(user);

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role.role_name,
      permissions,
    },
  };
};
```

**Mô tả:** Xác thực người dùng và phát JWT token.

**Tham số:**
| Tham số | Kiểu | Mô tả |
|--------|------|--------|
| `email` | string | Email người dùng |
| `password` | string | Mật khẩu plain text |

**Giá trị trả về:**
```typescript
{
	token: string, 
	user: {
		id: number,
		email: string,
		username: string,
		role: string,
		permissions: string[]
	}
}
```

**`googleLoginUser`**

```typescript
export const googleLoginUser = async (credential: string) => {
  if (!credential) {
    throw new Error('Thiếu token Google');
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential, 
    audience: process.env.GOOGLE_CLIENT_ID,
  }as any);

  const payload = ticket.getPayload();
  if (!payload) {
    throw new Error('Invalid Google token payload');
  }
  const googleId = payload.sub;
  const email = payload.email;
  if (!email) {
    throw new Error('Invalid Google token payload');
  }

  let user: any = await prisma.user.findUnique({
    where: { google_id: googleId },
    include: {
      role: {
        include: {
          permissions: true,
        },
      },
    },
  });

  if (!user) {
    if (email) {
      user = await prisma.user.findUnique ({
        where: {email},
        include :{
          role: {
            include: {
              permissions: true
            }
          }
        }
      });
    }
    
    if (user) {
      user = await prisma.user.update({
        where: { id: user.id},
        data :{
          google_id: googleId
        },
        include:{
          role: {
            include: {
              permissions: true
            }
          }
        }
      })
    }
    else {
      const hashedPassword = await bcrypt.hash(`google-${Date.now()}`, 10);
      user = await prisma.user.create({
        data: {
          email,
          username: (payload.name ?? email.split('@')[0]) as string,
          password: hashedPassword,
          google_id: googleId,
          role_id: 2
        },
        include: {
          role:{
            include: {
              permissions: true
            }
          }
        }
      })
    }
  }

  const { token, permissions } = generateToken(user);;

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role.role_name,
      permissions,
    },
  };
};
```

**Mô tả:** Xác thực đăng nhập qua Google và tự động liên kết với tài khoản đã có trên hệ thống nếu trùng email

**Tham số:**
| Tham số | Kiểu | Mô tả |
|--------|------|--------|
| `credential` | string | Google ID token (từ client) |

**Giá trị trả về:**
```typescript
{
	token: string,
	user: {
		id: number,
		email: string,
		username: string,
		role: string,
		permissions: string[]
	}
}
```

**`facebookLoginUser`**
```typescript
export const facebookLoginUser = async (token: string) => {
  const fbRes = await fetch(`https://graph.facebook.com/me?fields=id,name,email&access_token=${token}`);
  const fbData: any = await fbRes.json();

  if(!fbData.email) throw new Error('Không lấy được email từ Facebook');
  
  const facebookId = fbData.id;

  let user = await prisma.user.findUnique({
    where: { facebook_id: facebookId },
    include: {
      role: {
        include: {
          permissions: true,
        },
      },
    },
  });

  if (!user) {
    user = await prisma.user.findUnique({
      where: {email: fbData.email},
      include: {
        role: {
          include: {
            permissions: true
          }
        }
      }
    })

    if(user){
      user = await prisma.user.update ({
        where: {id: user.id},
        data: { facebook_id: facebookId},
        include: {
          role: {
            include: {
              permissions: true
            }
          }
        }
      })
    }
    else {
      const hashedPassword = await bcrypt.hash(`facebook-${Date.now()}`, 10);
      user = await prisma.user.create ({
        data: {
          email: fbData.email,
          username: fbData.name,
          password: hashedPassword,
          facebook_id: facebookId,
          role_id: 2
        },
        include: {
          role: {
            include:{
              permissions: true
            }
          }
        }
      })
    }
  }

  const { token: jwtToken, permissions } = generateToken(user);

  return {
    token: jwtToken,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role.role_name,
      permissions,
    },
  }
};
```

**Mô tả:** Sử dụng Facebook Graph API để xác thực mã truy cập (access token) của người dùng và tự động liên kết với tài khoản đã có trên hệ thống

**Tham số:**
| Tham số | Kiểu | Mô tả |
|--------|------|--------|
| `token` | string | Facebook access token |

**Giá trị trả về:**
```typescript
{
	token: string,
	user: {
		id: number,
		email: string,
		username: string,
		role: string,
		permissions: string[]
	}
}
```

**`hustLoginUser`**

```typescript
export const hustLoginUser = async (taikhoan: string, matkhau: string) => {
  if(!taikhoan || !matkhau) {
    throw new Error ('Thiếu tài khoản hoặc mật khẩu Hust')
  }

  const apiUrl = process.env.HUST_AUTH_API_URL;

  const queryParams = new URLSearchParams({
    taikhoan: taikhoan.trim(),
    matkhau: matkhau.trim()
  }).toString();

  const fullUrl = `${apiUrl}?${queryParams}`;
  console.log("Đang gọi URL:", fullUrl);
  const response = await fetch(fullUrl, {
    method: 'GET',
    headers: {
      'accept': 'text/plain',
    },
  });

  const result = (await response.text()).trim();

  if(result !== "1") {
    throw new Error ('Tài khoản hoặc mật khẩu không chính xác')
  }

  let user = await prisma.user.findUnique({
    where: { hust_id: taikhoan },
    include: {
      role: {
        include: {
          permissions: true
        },
      },
    },
  });

  if (!user) {
    user = await prisma.user.findUnique({ 
      where: { email: taikhoan},
      include: {
        role: {
          include: {
            permissions: true
          }
        }
      }
    });

    if(user) {
      user = await prisma.user.update({
        where: { id: user.id},
        data: { hust_id: taikhoan},
        include: {
          role: {
            include: {
              permissions: true
            }
          }
        }
      })
    }
    else {
      const emailPrefix = taikhoan.split('@')[0] ?? taikhoan;
      const username = emailPrefix.split('.')[0] ?? emailPrefix;
      const hashedPassword = await bcrypt.hash(`hust-${Date.now()}`, 10);
      user = await prisma.user.create ({
        data: {
          email: taikhoan,
          username: username,
          password: hashedPassword,
          hust_id: taikhoan,
          role_id: 2
        },
        include: {
          role: {
            include: {
              permissions: true
            }
          }
        }
      })
    }
  }
  const { token, permissions } = generateToken(user);

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role.role_name,
      permissions,
    },
  };
};
```

**Mô tả:** Kết nối với hệ thống xác thực của HUST để kiểm tra tài khoản và ự động ghép nối với tài khoản hiện có trên hệ thống nếu trùng thông tin

**Tham số:**
| Tham số | Kiểu | Mô tả |
|--------|------|--------|
| `taikhoan` | string | HUST student/staff ID hoặc email |
| `matkhau` | string | Mật khẩu HUST |

**Giá trị trả về:**
```typescript
{
	token: string,
	user: {
		id: number,
		email: string,
		username: string,
		role: string,
		permissions: string[]
	}
}
```

- #### Auth Middleware

**`verifyToken`**

```typescript
export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: "Bạn chưa đăng nhập (Thiếu Token)" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        (req as any).user = decoded; // Lưu thông tin giải mã (id, permissions...) vào req.user
        next();
    } catch (error) {
        return res.status(403).json({ error: "Token không hợp lệ hoặc đã hết hạn" });
    }
};
```

**Mô tả:** Kiểm tra và xác thực tính hợp lệ của JWT được gửi kèm trong Header, nhằm đảm bảo người dùng có quyền truy cập vào các tài nguyên được bảo vệ

**Tham số:**
- `req` (Express.Request) - request object
- `res` (Express.Response) - response object
- `next` (Function) - callback gọi hàm tiếp theo trong chain

**Xử lý nghiệp vụ:**
- Nếu token hợp lệ: gán `req.user = decoded` (chứa userId, role, permissions) và chuyển tiếp yêu cầu đến hàm xử lý tiếp theo (next())
- Nếu thiếu token: Từ chối yêu cầu và trả về lỗi HTTP 401 (người dùng "chưa chứng minh được mình là ai") kèm thông báo cụ thể
- Nếu token không hợp lệ: Từ chối yêu cầu và trả về lỗi HTTP 403 (token hợp lệ nhưng role của user không đủ quyền) kèm thông báo chi tiết về lỗi xác thực

**`checkPermission`**
```typescript
export const checkPermission = (permission: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        
        const userPermissions: string[] = user?.permissions || [];

        if (userPermissions.includes(permission)) {
            next(); // Có quyền -> Cho phép đi tiếp
        } 
        else {
            return res.status(403).json({
                error: `Bạn không có quyền truy cập: ${permission}`
            });
        }
    };
};
```

**Mô tả:** Middleware kiểm tra quyền của user từ token. **Phải sử dụng sau `verifyToken`** vì nó cần thông tin từ req.user đã được khởi tạo bởi verifyToken trước đó

**Tham số:**
| Tham số | Kiểu | Mô tả |
|--------|------|--------|
| `permission_name` | string | Tên quyền cần kiểm tra |

**Giá trị trả về:** Middleware function `(req, res, next) => void`

**Xử lý nghiệp vụ:**
- Nếu user có quyền: gọi `next()` để tiếp tục
- Nếu user không có quyền: trả HTTP 403 với error message

  
## KẾT QUẢ
https://drive.google.com/file/d/17SNAGalhQkKYkPofUxaavpbRJMLn5de1/view?usp=sharing
