# BÁO CÁO CHỐT YÊU CẦU HỆ THỐNG SHOP THANH TIEN

**Phiên bản:** 1.0  
**Ngày cập nhật:** 21/10/2026  
**Loại hệ thống:** Hệ thống quản trị nội bộ, không bao gồm giao diện khách hàng  
**Dự án tham chiếu:** `project-ecommerce`

---

## 1. Mục đích tài liệu

Tài liệu này dùng để chốt lại phạm vi, nghiệp vụ và các quyết định kỹ thuật đã thống nhất cho hệ thống quản trị Shop Thanh Tien.

Tài liệu là cơ sở để:

- Triển khai các module tiếp theo.
- Trao đổi và xác nhận với khách hàng.
- Hạn chế thay đổi nghiệp vụ giữa quá trình phát triển.
- Làm cơ sở nghiệm thu từng module.

---

## 2. Phạm vi hệ thống

Shop Thanh Tien là hệ thống **chỉ dành cho khu vực quản trị**, phục vụ hoạt động kinh doanh:

- Điện thoại.
- Đồng hồ.
- Phụ kiện.
- Mắt kính.
- Tranh.
- Nước hoa.
- Các mặt hàng khác.

Hệ thống không bao gồm client/storefront ở giai đoạn hiện tại.

Cách tổ chức code, flow xử lý và giao diện được kế thừa từ `project-ecommerce`, nhưng nghiệp vụ được điều chỉnh cho mô hình quản lý nội bộ và quản lý kho theo IMEI/serial.

---

## 3. Công nghệ sử dụng

- Node.js.
- Express 5.
- TypeScript.
- MongoDB Atlas hoặc MongoDB local.
- Mongoose.
- Pug.
- Bootstrap và giao diện admin tham chiếu từ `project-ecommerce`.
- JWT lưu trong HTTP-only cookie.
- bcryptjs để hash mật khẩu.
- Service file manager riêng cho việc lưu trữ media.

---

## 4. Vai trò và phân quyền

### 4.1. Admin

Admin có toàn quyền hệ thống:

- Quản lý tài khoản quản trị.
- Quản lý danh mục.
- Quản lý thuộc tính.
- Quản lý sản phẩm và variant.
- Quản lý nhà cung cấp.
- Nhập kho.
- Quản lý file.
- Xem và chỉnh giá nhập.

### 4.2. Manager

Manager được phép thực hiện các nghiệp vụ vận hành:

- Quản lý danh mục.
- Quản lý thuộc tính.
- Quản lý sản phẩm và variant.
- Quản lý nhà cung cấp.
- Nhập kho.
- Xem và chỉnh giá nhập.
- Quản lý file.

Manager không được quản lý tài khoản Admin/Manager.

### 4.3. Nhân viên bán hàng và nhân viên kho

Đây là các vai trò có thể bổ sung ở giai đoạn sau.

Theo yêu cầu hiện tại, nhân viên không được xem giá nhập. Việc phân quyền phải được kiểm tra tại backend, không chỉ ẩn trường trên giao diện.

---

## 5. Xác thực và tài khoản quản trị

### 5.1. Đăng nhập

- Người dùng đăng nhập bằng email và mật khẩu.
- Mật khẩu được hash bằng bcryptjs.
- JWT được lưu trong cookie HTTP-only `tokenAdmin`.
- Có tùy chọn ghi nhớ đăng nhập trong 1 ngày hoặc 7 ngày.
- Tài khoản bị vô hiệu hóa không thể đăng nhập.

### 5.2. Quản lý tài khoản

Đã thống nhất các chức năng:

- Danh sách tài khoản.
- Tạo tài khoản.
- Chỉnh sửa tài khoản.
- Đổi mật khẩu.
- Vô hiệu hóa tài khoản.
- Role gồm `admin` và `manager`.

Không được xóa tài khoản đang đăng nhập.

---

## 6. Danh mục sản phẩm

### 6.1. Cấu trúc

Danh mục hỗ trợ dạng cha/con:

```text
Điện thoại
├── iPhone
├── Samsung
└── Xiaomi

Đồng hồ
├── Cơ
└── Điện tử

Phụ kiện
├── Màn hình
├── Pin
├── Tai nghe
└── Sạc dự phòng
```

Ngoài ra có thể có các danh mục không cần danh mục con như:

- Mắt kính.
- Tranh.
- Nước hoa.

### 6.2. Chức năng

- Danh sách danh mục dạng cây.
- Tạo danh mục.
- Chỉnh sửa danh mục.
- Chọn danh mục cha.
- Trạng thái hoạt động/tạm dừng.
- Xóa mềm.
- Không cho danh mục chọn chính nó làm cha.
- Không cho xóa danh mục đang có danh mục con.
- Có slug tự động để định danh dễ đọc và phục vụ khả năng mở rộng sau này.
- Tìm kiếm danh mục theo tên; slug không phải cơ chế tìm kiếm duy nhất.

---

## 7. Thuộc tính sản phẩm

### 7.1. Loại thuộc tính

Hệ thống hỗ trợ:

- `text`
- `select`
- `color`

Ví dụ:

| Tên thuộc tính | Mã đề xuất | Loại |
|---|---|---|
| Màu sắc | `color` | `color` |
| ROM | `rom` | `select` |
| RAM | `ram` | `select` |
| Độ kính | `do-kinh` | `select` hoặc `text` |

### 7.2. Giá trị thuộc tính

Ví dụ thuộc tính màu sắc:

- Đen.
- Trắng.
- Cam vũ trụ.
- Demi.

Ví dụ thuộc tính ROM:

- 128GB.
- 256GB.

Ví dụ thuộc tính RAM:

- 8GB.
- 12GB.

### 7.3. Chức năng

- Danh sách thuộc tính.
- Tạo thuộc tính.
- Chỉnh sửa thuộc tính.
- Thêm/xóa giá trị động.
- Kiểm tra không trùng mã thuộc tính.
- Kiểm tra không trùng giá trị trong cùng một thuộc tính.
- Xóa mềm thuộc tính.
- Admin và Manager được quản lý thuộc tính.

---

## 8. Sản phẩm và variant

### 8.1. Mô hình kết hợp theo từng loại

Sử dụng mô hình sản phẩm cha và variant, nhưng áp dụng linh hoạt theo từng nhóm hàng.

```text
Product
└── ProductVariant
    └── InventoryItem
```

### 8.2. Điện thoại

- Có sản phẩm cha.
- Variant theo màu, ROM, RAM hoặc thuộc tính được chọn.
- Mỗi thiết bị có IMEI riêng.
- IMEI không được trùng trên toàn hệ thống.

### 8.3. Đồng hồ

- Có sản phẩm cha.
- Variant có thể theo màu, kích thước hoặc kiểu dáng.
- Mỗi thiết bị có serial/mã số riêng.
- Serial không được trùng trên toàn hệ thống.

### 8.4. Phụ kiện và mặt hàng không định danh

- Có thể dùng một variant mặc định.
- Quản lý tồn kho theo số lượng.
- Không bắt buộc IMEI/serial.

### 8.5. Sinh variant

- Khi tạo sản phẩm, bắt buộc phải có ít nhất một variant.
- Người dùng được chọn tối đa 2 thuộc tính để tránh tạo quá nhiều tổ hợp.
- Hệ thống sinh tổ hợp Cartesian của các giá trị thuộc tính.
- Label của thuộc tính màu có thể chỉnh riêng trong từng variant.

Ví dụ:

```text
Màu: Đen, Trắng
ROM: 128GB, 256GB

Sinh ra:
- Đen - 128GB
- Đen - 256GB
- Trắng - 128GB
- Trắng - 256GB
```

---

## 9. Giá sản phẩm và giá variant

### 9.1. Giá mặc định ở sản phẩm

Mỗi sản phẩm có:

- Giá nhập mặc định.
- Giá bán mặc định.

### 9.2. Giá ở variant

Mỗi variant có thể có:

- Giá nhập ghi đè.
- Giá bán ghi đè.

Nếu không chỉnh giá variant:

```text
Giá hiệu lực = Giá mặc định của sản phẩm
```

Nếu người dùng chỉnh giá variant:

```text
Giá hiệu lực = Giá riêng của variant
```

Giao diện vẫn hiển thị giá mặc định trong bảng variant để người dùng dễ theo dõi, nhưng backend chỉ lưu giá override khi người dùng thực sự thay đổi.

### 9.3. Bảo mật giá nhập

- Admin và Manager được xem/chỉnh giá nhập.
- Các vai trò nhân viên không được nhận trường giá nhập từ backend.
- Không chỉ ẩn giá nhập bằng CSS hoặc Pug.

---

## 10. SKU

SKU variant được tự động sinh theo sản phẩm và giá trị thuộc tính.

Ví dụ:

```text
IPHONE-15-DEN-128GB
IPHONE-15-TRANG-256GB
```

Người dùng vẫn có thể chỉnh SKU thủ công nếu cần.

---

## 11. Nhập kho

### 11.1. Nguyên tắc

Tạo sản phẩm không đồng nghĩa với có tồn kho.

Tồn kho phát sinh khi người dùng tạo phiếu nhập kho.

### 11.2. Nhập theo loại định danh

| Loại hàng | Cách nhập kho |
|---|---|
| Điện thoại | Nhiều IMEI, có thể dán hoặc quét mã |
| Đồng hồ | Nhiều serial/mã số |
| Phụ kiện | Số lượng |
| Nước hoa/mặt hàng nhỏ | Số lượng nếu không có mã định danh |

### 11.3. Kiểm tra

- Variant phải tồn tại và đang hoạt động.
- Phiếu nhập phải có ít nhất một dòng hàng.
- IMEI/serial không được rỗng.
- IMEI/serial không được trùng trong cùng phiếu.
- IMEI/serial không được trùng với dữ liệu đã có trong kho.
- Hàng quản lý theo số lượng phải có số nguyên lớn hơn 0.

---

## 12. Nhà cung cấp

### 12.1. Thông tin lưu trữ

Nhà cung cấp gồm:

- Tên nhà cung cấp.
- Địa chỉ.
- Số điện thoại.
- Trạng thái hoạt động/tạm dừng.

### 12.2. Chức năng

- Danh sách nhà cung cấp.
- Tạo nhà cung cấp.
- Chỉnh sửa nhà cung cấp.
- Vô hiệu hóa nhà cung cấp.
- Admin và Manager được quản lý nhà cung cấp.

### 12.3. Phiếu nhập kho

Trong phiếu nhập kho:

- Nhà cung cấp được chọn từ dropdown danh sách đã tạo.
- Không nhập tên nhà cung cấp tự do.
- Có thêm trường bắt buộc `Nhân viên bên nhà cung cấp` để lưu tên người giao hàng/liên hệ.

Dữ liệu phiếu nhập lưu:

```text
supplierId
supplierContactName
```

---

## 13. File manager

Hệ thống sử dụng file manager riêng tương tự `project-ecommerce-filemanager`.

Yêu cầu:

- Lưu file trong thư mục media riêng của Shop Thanh Tien.
- Người dùng có thể tự tạo thư mục con.
- Quản lý ảnh sản phẩm.
- Quản lý ảnh variant/IMEI.
- Có thể mở rộng cho tài liệu bảo hành và file nhập kho.

Các vấn đề bảo mật cần đảm bảo khi hoàn thiện:

- Chuẩn hóa path để chống path traversal.
- Kiểm soát quyền upload/xóa file.
- Đồng bộ metadata MongoDB và file trên filesystem.
- Không để file `.env` hoặc credential trong media/public.

---

## 14. Giao diện quản trị

Giao diện kế thừa visual language từ `project-ecommerce`:

- Header/topbar.
- Sidebar/startbar.
- Footer.
- Bootstrap theme.
- Responsive layout.
- Các vùng danh mục và thuộc tính có khung scroll.
- Danh mục hiển thị dạng cây cha/con.
- Thuộc tính hiển thị dạng danh sách phẳng có tìm kiếm.

Các vùng dữ liệu lớn cần hỗ trợ:

- Tìm kiếm.
- Scroll cố định.
- Hiển thị cấp cha/con rõ ràng.
- Không làm vỡ layout khi dữ liệu tăng.

---

## 15. Các module đã triển khai

- Khởi tạo Express + TypeScript + Mongoose.
- Kết nối MongoDB Atlas/local.
- Login Admin/Manager.
- JWT HTTP-only cookie.
- Phân quyền server-side.
- Quản lý tài khoản Admin/Manager.
- Header và sidebar admin.
- CRUD danh mục cha/con.
- CRUD thuộc tính sản phẩm.
- Form tạo sản phẩm cơ bản.
- Sinh variant tối đa 2 thuộc tính.
- Giá mặc định và giá override ở variant.
- SKU variant tự sinh.
- Phiếu nhập kho.
- Nhập IMEI/serial/số lượng.
- CRUD nhà cung cấp.
- Chọn nhà cung cấp trong phiếu nhập.
- Lưu nhân viên bên nhà cung cấp.

---

## 16. Các module còn cần triển khai

### Ưu tiên tiếp theo

1. Danh sách tồn kho.
2. Danh sách phiếu nhập kho.
3. Chi tiết phiếu nhập kho.
4. Bộ lọc tồn kho theo sản phẩm, variant, IMEI, serial và trạng thái.
5. Cập nhật trạng thái hàng: đã bán, bảo hành, trả hàng, hỏng, thanh lý.

### Các module sau đó

- Danh sách và chỉnh sửa sản phẩm.
- Chỉnh sửa variant sau khi tạo.
- Quản lý thương hiệu.
- Quản lý khách hàng.
- Bán hàng và đơn hàng.
- Bảo hành và đổi trả.
- Báo cáo doanh thu/tồn kho.
- File manager tích hợp đầy đủ.
- Audit log hoạt động quản trị.

---

## 17. Luồng nghiệp vụ tổng quát

```text
Tạo danh mục
    ↓
Tạo thuộc tính và giá trị thuộc tính
    ↓
Tạo sản phẩm
    ↓
Chọn danh mục và tối đa 2 thuộc tính
    ↓
Sinh ProductVariant
    ↓
Tạo hoặc chọn nhà cung cấp
    ↓
Tạo phiếu nhập kho
    ↓
Nhập IMEI / serial / số lượng
    ↓
Sinh InventoryItem
    ↓
Theo dõi tồn kho và trạng thái hàng
```

---

## 18. Quy tắc nghiệm thu chính

### Danh mục

- Tạo được danh mục cha.
- Tạo được danh mục con.
- Hiển thị đúng cây cha/con.
- Không tạo được cycle.
- Không xóa được danh mục còn con.

### Thuộc tính

- Tạo được thuộc tính với loại `text`, `select`, `color`.
- Thêm được nhiều giá trị.
- Không trùng mã thuộc tính.
- Không trùng giá trị trong cùng thuộc tính.

### Sản phẩm

- Sản phẩm phải có ít nhất một variant.
- Không chọn quá 2 thuộc tính.
- Sinh đúng tổ hợp variant.
- Giá variant kế thừa đúng giá sản phẩm.
- SKU được sinh tự động và có thể chỉnh tay.

### Nhập kho

- Điện thoại yêu cầu IMEI.
- Đồng hồ yêu cầu serial.
- Phụ kiện cho phép nhập số lượng.
- Không cho phép IMEI/serial trùng.
- Phải chọn nhà cung cấp.
- Phải nhập tên nhân viên bên nhà cung cấp.

### Phân quyền

- Người chưa đăng nhập bị chặn server-side.
- Manager không được quản lý tài khoản quản trị.
- Giá nhập không được trả về cho role không đủ quyền.

---

## 19. Ghi chú bảo mật

- Không commit `.env` lên GitHub.
- Không đưa MongoDB URI, password hoặc JWT secret vào tài liệu public.
- Password tài khoản phải được hash.
- Không dùng plaintext password cho super admin.
- Cookie JWT phải là HTTP-only.
- Các route nhạy cảm phải kiểm tra quyền ở backend.
- MongoDB Atlas cần giới hạn IP truy cập thay vì sử dụng `0.0.0.0/0` lâu dài.

---

## 20. Trạng thái chốt

Các nội dung trong tài liệu này là phạm vi và nghiệp vụ đã thống nhất cho giai đoạn hiện tại. Những thay đổi ngoài phạm vi cần được xác nhận bổ sung trước khi triển khai để tránh ảnh hưởng schema, API và flow kho.

**Người xác nhận phía khách hàng:** ........................................  
**Ngày xác nhận:** ........................................  
**Người thực hiện:** ........................................  
**Ngày triển khai:** ........................................
