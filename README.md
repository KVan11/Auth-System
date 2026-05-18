
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
<img width="1717" height="432" alt="image" src="https://github.com/user-attachments/assets/da064c43-b5dd-49e4-adff-e70c8cac7285" />

  
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
VITE_GOOGLE_CLIENT_ID="your_google_client_id.apps.googleusercontent.com"

# Cổng API xác thực HUST (ToolHub)
HUST_AUTH_API_URL="https://api.example.com/hust-auth"
```
- Bước 4: Đồng bộ Databse với Prisma
```bash
# tạo/migrate schema (nếu muốn tạo migration)
npx prisma migrate dev --name init
# sinh prisma client
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
VITE_API_BASE_URL="http://localhost:3000/api"
VITE_GOOGLE_CLIENT_ID="your_google_client_id.apps.googleusercontent.com"
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

- Ví dụ: tạo token bằng JWT.
- Ví dụ: băm mật khẩu bằng MD5 theo công thức: MD5(key+"myapp"+key).
- Ví dụ: tạo id cho đối tượng bằng GUID, hoặc bằng hàm random.

> Nên sử dụng cú pháp mermaid trong markdown, cho phép từ text sinh ra đồ thị. Như vậy dễ hiệu chỉnh. Ví dụ, hoặc [có thể sửa online rồi copy vào tài liệu](https://www.mermaidchart.com/play?utm_source=mermaid_live_editor&utm_medium=share#pako:eNqrVkrOT0lVslJKy8kvT85ILCpRCHGJyVMAAsfokMOr8hRyMx_ubsyLVdDVtaspyXy4a39BjYKThu_hhZUKyRkPdy_XhKh2AilQcK4OT00qzixJrYWIOoO1-eel1ii4RLsV5eeV6KbmpSikJVqlJeqmVqbGIisLKc-vUXCNdkpMzkZSVZxaVJZaBFSoVAsA0_I7vg)

```mermaid
flowchart TD
    A[Tên miền] -->|tiếp| B(Máy chủ)
    B --> C{Website}
    C -->|One| D[Front-end fa:fa-eye]
    C -->|Two| E[Back-end fa:fa-server]

```


### THIẾT KẾ CƠ SỞ DỮ LIỆU

- Sơ đồ quan hệ thực thể để thể hiện mối quan hệ giữa các trường thông tin.
- Giải thích các table, và một vài table.field quan trọng
- Cấu trúc các file cấu hình như .env, .conf, .xml

> Nên sử dụng cú pháp mermaid trong markdown, cho phép từ text sinh ra đồ thị. Như vậy dễ hiệu chỉnh. Ví dụ, hoặc [có thể sửa online rồi copy vào tài liệu](https://mermaidchart.com/play?utm_source=mermaid_live_editor&utm_medium=share#pako:eNqdUsGKwjAQ_ZUw5yra1qq5qoc9iIurl6WwhCatgTbpphNYt_rvm7ZWlIKHndPM4-XNy2NqSDQXQEGYtWSZYUWsiKvV8eOw22725HIZjXRNdvu1Gygpc5aIquN0WEO43Ahfb4fN1rESrZBJdeO973fr4-rwJNUzpUpyy3vF-9a6m5uq0EiVEckHkGKFGICiYDLv0OujzdeKnKEg2nCXgusG1AoZ2upJtf_UP5ymuWZISiMTMTTaBfOgKhWSb8sUSjy_0gAPMiM50JTllfCgEMZF4WZoxWLAk3AugLqWi5TZHGOIVfOuZOpT6wIoGuteGm2zUz_Yssnmdht3hlAuqpW2CoEuWwGgNfwADSbT8TRyFUSTwI_C0IOzQ6Nx5IfLRTjzF_No7gdXD37bjZPxYj7zQHCJ2my7U2wv8voHm3HFLQ) 

```mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ ORDER_ITEM : contains
    PRODUCT ||--o{ ORDER_ITEM : includes
    CUSTOMER {
        string id
        string name
        string email
    }
    ORDER {
        string id
        date orderDate
        string status
    }
    PRODUCT {
        string id
        string name
        float price
    }
    ORDER_ITEM {
        int quantity
        float price
    }
```

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
Các ảnh chụp với caption giải thích.
Hoặc video sản phẩm
