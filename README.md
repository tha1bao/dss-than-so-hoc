# DSS Thần số học – web demo (DSS301, ASS2)

Web demo của hệ hỗ trợ ra quyết định gợi ý nhóm ngành đại học cho học sinh THPT dựa trên hồ sơ thần số học (Pythagoras, Kabala, Vệ Đà) và kỹ năng tự đánh giá. Giao diện tiếng Việt, có nút chuyển sang tiếng Anh.

## Chức năng

- **Nhập hồ sơ mới**: họ tên, ngày sinh, 3 kỹ năng mạnh nhất, môi trường làm việc mong muốn → web tự tính biểu đồ ngày sinh, 5 nhóm tín hiệu (G1, G5, G6, G4, G2), Soul Urge và chấm 35 hồ sơ ngành.
- **Top-3 hồ sơ ngành** với điểm C = α·NF + β·SR + γ·ENV, nhãn Ưu tiên / Cân nhắc / Thử thách / Không đề xuất, NF, EC, SR, ENV, SAT, STR, kỹ năng cần phát triển và danh sách ngành cụ thể.
- **What-if**: đổi persona (Học sinh / Phụ huynh / Tư vấn viên) hoặc tự chỉnh α β γ; bật/tắt từng nhóm tín hiệu; bỏ trọng số vị trí; quy tắc chữ Y; thử môi trường khác; tăng/giảm từng kỹ năng; Bước 5 – ngành mục tiêu; α-sweep.
- **Hồ sơ mẫu** HS001, HS021, HS015 để chạy lại 3 tình huống trong bài.

Quy ước kỹ năng khi nhập hồ sơ mới: kỹ năng mạnh thứ 1 = 5, thứ 2 và 3 = 4, các kỹ năng còn lại = 3 (mức trung bình). Chỉnh chi tiết ở phần What-if.

## Kiểm chứng với file Excel

Engine (`src/lib/numerology.js`, `src/lib/engine.js`) dùng đúng công thức và tham số của `DSS_ASS2_ThanSoHoc_v6.xlsx`. Chạy:

```bash
npm install
npm run verify
```

Bộ kiểm tra so với Excel: 19 chỉ số thần số học × 300 học sinh, 35 hồ sơ của Student_Report (HS007), 12 kịch bản What-if, và 300 HS × 5 cấu hình của Sensitivity. Tất cả đều khớp.

## Chạy trên máy

```bash
npm install
npm run dev        # mở http://localhost:5173
npm run build      # tạo bản build trong dist/
```

Cần Node.js 18 trở lên.

## Đưa lên Vercel

1. Vào https://vercel.com, đăng nhập bằng GitHub.
2. **Add New → Project**, chọn repo `tha1bao/dss-than-so-hoc`, bấm **Import**.
3. Vercel tự nhận ra Vite (Build Command `npm run build`, Output Directory `dist`). Bấm **Deploy**.
4. Từ đó, mỗi lần push lên nhánh `main`, Vercel tự build và cập nhật web.

## Cập nhật dữ liệu khi file Excel thay đổi

Xuất file Google Sheets/Excel v6 ra dạng văn bản (mỗi sheet bắt đầu bằng dòng `## Sheet name: ...`), rồi chạy:

```bash
python3 scripts/export_v6.py duong-dan-file-v6.txt
npm run verify
```

Lệnh trên ghi lại `src/data/*.json` (dữ liệu web dùng) và `scripts/fixtures/*.json` (dữ liệu kiểm chứng).

## Cấu trúc

```
src/
  lib/numerology.js   tính hồ sơ thần số học (Rule PY00–PY07, VE01–VE03, KB01–KB04)
  lib/engine.js       chấm điểm 35 hồ sơ ngành, nhãn, Bước 5, α-sweep
  data/               tham số, 35 hồ sơ ngành, 300 ngành, hồ sơ mẫu
  components/         giao diện React
  i18n.js             từ điển VN / EN
scripts/
  export_v6.py        xuất dữ liệu từ file v6
  verify.test.js      kiểm chứng engine với Excel
```

## Lưu ý

Dữ liệu học sinh là mô phỏng. Điểm C là mức tương hợp theo hệ tri thức thần số học và kỹ năng tự đánh giá, không phải xác suất thành công. Thần số học không có kiểm chứng khoa học về khả năng dự đoán; học sinh và gia đình là người quyết định.
