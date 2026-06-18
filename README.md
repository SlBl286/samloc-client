# Sâm Lốc Online - Client Lobby Engine

Giao diện chơi game bài **Sâm Lốc Online** trực quan, mượt mà được xây dựng trên nền tảng WebGL hiệu năng cao cùng các hiệu ứng chuyển động chất lượng cao.

## 🛠️ Công Nghệ Sử Dụng

- **Bundler & Core**: [Vite](https://vite.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Game Engine (Canvas)**: [PixiJS v8](https://pixijs.com/) - Engine đồ họa 2D WebGL siêu tốc.
- **Animation**: [GSAP (GreenSock Animation Platform)](https://gsap.com/) - Xử lý chuyển động mượt mà cho hiệu ứng chia bài, xáo bài, hover và chọn bài.
- **Styling**: [TailwindCSS v4](https://tailwindcss.com/) - Thư viện CSS hiện đại tối giản config, tích hợp trực tiếp qua Vite plugin.
- **Package Manager**: [Bun](https://bun.sh/) - Cài đặt và chạy dự án cực nhanh.

---

## ✨ Các Tính Năng Đã Triển Khai

1. **Giao Diện Lobby Hiện Đại**: Sử dụng phong cách Glassmorphic tinh tế, độ tương phản cao, tối ưu hiển thị trên cả di động và máy tính.
2. **WebGL Game Table**: Vẽ bàn chơi và các hiệu ứng hạt nổi lung linh bằng PixiJS.
3. **Hiệu Ứng Xáo & Chia Bài (GSAP)**:
   - **Xáo bài**: Gom bài về tâm, xoay góc ngẫu nhiên và rung lắc mạnh mẽ.
   - **Chia bài**: Phân phối lần lượt 10 quân bài (luật chơi Sâm Lốc) xuống tay người chơi theo dạng hình quạt với độ trễ (stagger) chân thực.
4. **Tương Tác Quân Bài**:
   - Hover: Nhấc nhẹ quân bài lên, hiển thị viền neon hồng.
   - Click/Tap: Chọn quân bài (nhô hẳn lên 40px và viền đổi sang màu vàng neon) tương tự thao tác chọn bài ngoài thực tế.
5. **Real-time Server State Connection**: Kết nối WebSocket tới server Rust (`ws://127.0.0.1:8080`) để hiển thị trạng thái kết nối trực tiếp lên giao diện (tự động kết nối lại khi server offline).

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Dự Án

### Yêu Cầu Hệ Thống
Đã cài đặt **Bun** trên máy (khuyên dùng theo cấu hình hệ thống hiện tại).

### Các Bước Thực Hiện

1. **Di chuyển vào thư mục client**:
   ```bash
   cd e:/Code/samloc-client
   ```

2. **Cài đặt các gói phụ thuộc (dependencies)**:
   ```bash
   bun install
   ```

3. **Chạy server phát triển (Development mode)**:
   ```bash
   bun run dev
   ```
   *Mặc định client sẽ chạy tại địa chỉ: [http://localhost:3000](http://localhost:3000)*

4. **Biên dịch sản phẩm (Production build)**:
   ```bash
   bun run build
   ```
   *Các tệp tin sau biên dịch sẽ nằm trong thư mục `./dist`.*

---

## 📁 Cấu Trúc Thư Mục Dự Án

```text
samloc-client/
├── public/              # Tài nguyên tĩnh (favicon, v.v.)
├── src/
│   ├── assets/          # Hình ảnh, logo svg mẫu
│   ├── index.css        # Import TailwindCSS v4, Google Fonts & custom CSS
│   └── main.ts          # Logic game loop (PixiJS), hiệu ứng (GSAP) & kết nối WS
├── index.html           # File HTML chính chứa khung UI Overlay
├── tsconfig.json        # Cấu hình TypeScript
└── vite.config.ts       # Cấu hình Vite với plugin TailwindCSS v4
```

---

## 🔗 Liên Kết
Dự án client này được thiết kế để kết nối đồng bộ với backend [Sâm Lốc Server (Rust/Axum)](../sam-loc-server).
