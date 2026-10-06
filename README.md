# 🥋 Kế hoạch thi thăng đai — Web quản lý (HTML + Apps Script + Google Sheets)

Trang web quản lý kế hoạch thi thăng đai, dựng theo đúng mẫu file PDF *“Kế hoạch thi thăng đai – 7/6/2026”*.
Dữ liệu lưu trong **Google Sheets**, giao diện web cho phép **Thêm / Xem / Sửa / Xóa (CRUD)** toàn bộ kế hoạch.

## Tính năng

| Mục | Nội dung |
|---|---|
| **Tổng quan** | Đếm ngược đến ngày thi, tiến độ từng phần (% hoàn thành), danh sách việc **quá hạn** và **sắp đến hạn (7 ngày)**, tra cứu “người này phụ trách những việc gì”. |
| **1. Chuẩn bị** | Công việc chia nhóm A/B/C (Tổng hợp, Tài liệu & Truyền thông, Hậu cần & Kỹ thuật), deadline kèm thứ trong tuần và buổi, người phụ trách, nhân sự hỗ trợ, trạng thái, ghi chú. |
| **2. Ngày thi** | Lịch trình theo giờ (6:30 → 13:00), nhân sự chính, chi tiết từng việc; vào đúng ngày thi tự tô sáng mốc **đang diễn ra**. |
| **3. Hậu kỳ** | Việc sau kỳ thi, deadline, người phụ trách (P/C), hỗ trợ (H/T). |
| **Nhân sự** | Ban / Tiểu ban (I, II, III), trưởng ban, nhân sự hỗ trợ, nhiệm vụ. |
| **CRUD** | Thêm, sửa, **nhân bản**, xóa (có hỏi xác nhận); đổi trạng thái nhanh ngay trên bảng; gợi ý tên người khi nhập. |
| **Tìm kiếm & lọc** | Tìm không cần gõ dấu; lọc theo trạng thái, “Chưa hoàn thành”, “Quá hạn”. |
| **In / Xuất PDF** | In toàn bộ hoặc từng phần, bố cục giống file PDF gốc (A4 ngang). |
| **Kỳ thi mới** | Chọn ngày thi mới → tự dời **mọi deadline** theo số ngày chênh lệch và đặt lại trạng thái. Dùng lại kế hoạch cho các kỳ sau. |
| **Bảo mật** | Mã quản trị: ai cũng xem được, chỉ người có mã mới sửa được. |
| **Điện thoại** | Tự chuyển bảng thành dạng thẻ trên màn hình nhỏ. |

## Các file

| File | Vai trò |
|---|---|
| `Code.gs` | Máy chủ Google Apps Script: đọc/ghi Google Sheets, API, menu trong Sheets, dữ liệu mẫu từ PDF. |
| `index.html` | Toàn bộ giao diện web (HTML + CSS + JavaScript, một file duy nhất). |
| `capnhat.html` | Trang cập nhật `data.json` (xem trạng thái, cập nhật ngay, tải về máy). |
| `data.json` | Bản chụp dữ liệu kế hoạch để trang mở tức thì. Do Apps Script tự tạo — không cần sửa tay. |
| `.nojekyll` | Giúp GitHub Pages phát hành nhanh hơn (bỏ qua bước Jekyll). |

---

## HƯỚNG DẪN CÀI ĐẶT TỪNG BƯỚC

> ⏱ Mất khoảng 10 phút. Chỉ cần một tài khoản Google, không cần cài đặt gì thêm.
> Tên nút trong Google có thể hiện tiếng Việt hoặc tiếng Anh tùy cài đặt — hướng dẫn ghi cả hai.

### Bước 1 — Tạo Google Sheet

1. Mở <https://sheets.new> (hoặc Google Drive → **Mới → Google Trang tính**).
2. Đặt tên, ví dụ: `Kế hoạch thi thăng đai`.

### Bước 2 — Mở Apps Script từ Google Sheet

1. Trong Google Sheet vừa tạo, chọn menu **Tiện ích mở rộng (Extensions) → Apps Script**.
2. Một tab mới mở ra, có sẵn file `Code.gs` với vài dòng mặc định.

> ⚠️ Phải mở Apps Script **từ trong Google Sheet** như trên, để script được gắn với bảng tính này.

### Bước 3 — Dán mã máy chủ (`Code.gs`)

1. Mở file [`Code.gs`](Code.gs) trong kho mã này, bấm nút **Copy raw file** (hoặc bôi đen tất cả rồi sao chép).
2. Quay lại Apps Script, **xóa hết** nội dung trong `Code.gs`, dán đoạn vừa sao chép vào.
3. Bấm biểu tượng 💾 **Lưu** (hoặc `Ctrl + S`).

### Bước 4 — Tạo file giao diện `Index`

1. Ở cột bên trái, cạnh chữ **Tệp (Files)**, bấm dấu **＋** → chọn **HTML**.
2. Gõ tên **`Index`** (chữ **I viết hoa**, không cần gõ `.html`) rồi Enter.
3. Xóa hết nội dung mặc định trong `Index.html`, dán **toàn bộ** nội dung file [`index.html`](index.html).
4. Bấm **Lưu**.

### Bước 5 — Chạy cài đặt ban đầu và cấp quyền

1. Trên thanh công cụ, ở ô chọn hàm (cạnh nút **Gỡ lỗi / Debug**), chọn **`caiDatBanDau`**.
2. Bấm **▶ Chạy (Run)**.
3. Google hỏi quyền truy cập → **Xem xét quyền (Review permissions)** → chọn tài khoản của bạn.
4. Nếu thấy cảnh báo *“Google chưa xác minh ứng dụng này”*: bấm **Nâng cao (Advanced)** → **Truy cập … (không an toàn) / Go to … (unsafe)** → **Cho phép (Allow)**.
   *Cảnh báo này là bình thường vì đây là script do chính bạn tạo.*
5. Quay lại Google Sheet: các trang tính **1. Chuẩn bị**, **2. Ngày thi**, **3. Hậu kỳ**, **Nhân sự**, **Cài đặt** đã được tạo kèm toàn bộ dữ liệu từ file PDF.
6. Tải lại (F5) Google Sheet → xuất hiện menu **🥋 Thi thăng đai** trên thanh menu.

### Bước 6 — Triển khai thành trang web

1. Trong Apps Script, bấm nút xanh **Triển khai (Deploy) → Tùy chọn triển khai mới (New deployment)**.
2. Bấm biểu tượng ⚙️ cạnh *Chọn loại (Select type)* → chọn **Ứng dụng web (Web app)**.
3. Điền:
   - **Mô tả:** `Kế hoạch thi thăng đai`
   - **Thực thi dưới tên (Execute as):** **Tôi (Me)** ← để người xem không cần quyền vào file Sheet.
   - **Người có quyền truy cập (Who has access):**
     - **Bất kỳ ai (Anyone)** — ai có đường link đều mở được, không cần đăng nhập; hoặc
     - **Bất kỳ ai có Tài khoản Google** — phải đăng nhập Google mới mở được.
4. Bấm **Triển khai (Deploy)** → sao chép **URL ứng dụng web** (dạng `https://script.google.com/macros/s/…/exec`).
5. Mở URL đó trên trình duyệt hoặc điện thoại → trang quản lý đã sẵn sàng. 🎉

### Bước 7 — Đặt mã quản trị (rất nên làm)

Nếu không đặt mã, **ai có link đều sửa/xóa được dữ liệu**.

1. Trong Google Sheet: menu **🥋 Thi thăng đai → Đặt / đổi mã quản trị** → nhập mã (ít nhất 4 ký tự) → OK.
2. Từ giờ, mọi người vẫn **xem** được kế hoạch; khi bấm thêm/sửa/xóa, trang web sẽ hỏi mã.
   Nhập đúng một lần, trình duyệt sẽ nhớ (có nút “Quên mã trên máy này” ở mục **Cài đặt**).
3. Muốn tắt: menu **🥋 Thi thăng đai → Xóa mã quản trị**.

---

## ⚠️ Khi sửa code sau này — phải tạo phiên bản mới

Sau khi sửa `Code.gs` hoặc `Index.html`, trang web **chưa đổi ngay**. Cần:

**Triển khai (Deploy) → Quản lý các lần triển khai (Manage deployments)** → chọn bản đang dùng → ✏️ **Chỉnh sửa** →
mục **Phiên bản (Version)** chọn **Phiên bản mới (New version)** → **Triển khai**.

---

## ⚡ Tăng tốc bằng `data.json` (khi dùng GitHub Pages)

Apps Script luôn mất vài giây để trả lời. Vì vậy trang web đọc trước file tĩnh **`data.json`** (đặt cạnh `index.html` trên GitHub Pages, tải gần như tức thì), hiện kế hoạch ngay, rồi mới hỏi Apps Script ở nền xem có dữ liệu mới hơn không.

```
Mở trang ──► data.json (≈0,1 giây) ──► hiện kế hoạch ngay
        └──► Apps Script (vài giây, chạy nền) ──► có thay đổi thì tự cập nhật màn hình
Sửa trên web ──► Apps Script ghi Google Sheets ──► ~20 giây sau tự ghi data.json lên GitHub
```

**Cấu trúc `data.json`:**

```json
{
  "format": "kehoach-thithangdai/1",
  "version": "…",
  "publishedAt": "2026-10-06T09:38:37.000Z",
  "hash": "sha256 của phần data",
  "data": { "settings": {…}, "chuanBi": […], "ngayThi": […], "hauKy": […], "nhanSu": […] }
}
```

### Cài đặt (một lần)

1. **Tạo mã truy cập GitHub:** ảnh đại diện → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
   - *Repository access*: **Only select repositories** → chọn kho này.
   - *Permissions → Repository permissions → Contents*: **Read and write**.
   - Bấm **Generate token** và sao chép mã (bắt đầu bằng `github_pat_`).
2. **Dán `Code.gs` mới** vào Apps Script → Lưu.
3. **Tải lại (F5) Google Sheet** để thấy menu mới, rồi chọn **🥋 Thi thăng đai → Cài đặt cập nhật data.json (GitHub)**. Nhập tên kho (ví dụ `lelevietnam99/KEHOACH_THITHANGDAI`) và nhánh (`main`), rồi dán mã.
   Google sẽ hỏi thêm quyền **“kết nối tới dịch vụ bên ngoài”**: bấm **Cho phép**. Quyền này cần để Apps Script ghi được lên GitHub.
4. **Triển khai phiên bản mới** của Web App: **Triển khai → Quản lý các lần triển khai → ✏️ → Phiên bản mới → Triển khai**.
5. Đưa `index.html`, `capnhat.html`, `.nojekyll` lên nhánh chạy GitHub Pages.

> ⚠️ Phải làm bước 3 (cấp quyền) **trước** bước 4. Nếu chưa cấp quyền mà đã triển khai, Web App sẽ báo lỗi “cần cấp quyền”.

### Sử dụng

- **Tự động:** sau mỗi lần thêm/sửa/xóa trên trang kế hoạch, `data.json` tự cập nhật sau khoảng 20 giây (gom nhiều lần sửa thành một lần ghi).
  Bật/tắt bằng menu **🥋 Thi thăng đai → Bật / tắt tự động cập nhật data.json**.
- **Thủ công:** mở **`capnhat.html`** (hoặc **Cài đặt → Trang cập nhật data.json**) để xem `data.json` đã khớp Google Sheets chưa, rồi bấm **Cập nhật data.json ngay**.
  Nên dùng sau khi sửa trực tiếp trong Google Sheets.
- **Không muốn tạo mã GitHub?** Trên `capnhat.html` bấm **Tải data.json về máy**, rồi tải file lên kho GitHub (**Add file → Upload files → Commit changes**).
- `data.json` cũ hơn Google Sheets cũng **không làm sai dữ liệu**: trang vẫn tự hiện bản mới nhất sau vài giây. Trang cũng chỉ cho sửa khi đã có dữ liệu mới nhất.

> 🔒 `data.json` nằm trong kho GitHub công khai, nên ai cũng xem được (giống như trang web). Đừng ghi số điện thoại hay thông tin riêng tư vào kế hoạch.
> Mã truy cập GitHub chỉ lưu trong *Thuộc tính tập lệnh* của Apps Script, không bao giờ gửi ra trình duyệt.
