# Mô Tả Gameplay Hiện Tại - Sâm Lốc Online

Tài liệu này mô tả chi tiết cách vận hành game, luật chơi, cách tính điểm và các giai đoạn (phase) của trò chơi Sâm Lốc hiện tại dựa trên mã nguồn của Client và Server.

---

## 1. Cấu Trúc Phòng & Vai Trò Người Chơi
- **Chủ phòng (Host)**: 
  - Là người đầu tiên tạo hoặc tham gia phòng chơi. Tên có vương miện `👑` và hiển thị trạng thái `CHỦ PHÒNG`.
  - Không cần nhấn "Sẵn Sàng".
  - Có quyền nhấn **"Bắt Đầu"** để khởi chạy ván đấu khi phòng có **ít nhất 1 người chơi khác sẵn sàng**.
  - **Chuyển chủ phòng (Host Migration)**: Khi chủ phòng rời phòng chơi, vị trí chủ phòng và biểu tượng vương miện `👑` sẽ được tự động chuyển giao sang cho người chơi kế tiếp tham gia phòng.
- **Người chơi thường**:
  - Cần bấm nút **"Sẵn Sàng"** để báo hiệu đã sẵn sàng chơi.
- **Người xem (Spectator)**:
  - Bất kỳ ai ở trong phòng nhưng **chưa sẵn sàng** khi chủ phòng nhấn "Bắt Đầu" sẽ tự động trở thành người xem ván đấu.
  - Không được chia bài, không có các phím chức năng hành động, chỉ xem diễn biến trận đấu và bảng tổng kết cuối ván.

---

## 2. Giai Đoạn Chia Bài & Xác Định Người Đi Đầu (Starter)
- Khi bắt đầu, bộ bài 52 lá được xáo và chia cho **Chủ phòng + những người chơi sẵn sàng**, mỗi người 10 lá bài.
- **Xác định Người đi đầu (Starter)**:
  - Ván đầu tiên của phòng: Người đi đầu là **Chủ phòng**.
  - Các ván tiếp theo: Người đi đầu là **Người giành chiến thắng ở ván liền trước**. Nếu người đó đã rời phòng, quyền đi đầu trả lại cho Chủ phòng.

---

## 3. Thứ Tự Xét Bài Tới Trắng (Instant Win)
Ngay sau khi chia bài, hệ thống sẽ kiểm tra điều kiện **Tới Trắng** theo vòng chơi, **bắt đầu từ Người đi đầu (Starter)**. Người đầu tiên có bài thỏa mãn một trong các điều kiện sau sẽ thắng ngay lập tức:
1. **Sảnh rồng (DragonStraight)**: 10 lá bài liên tiếp (từ 3 đến A, không chấp nhận quân 2 trong sảnh).
2. **Tứ quý 2 (FourOfAKind2)**: Có đủ 4 quân Heo (2♠, 2♣, 2♦, 2♥).
3. **Đồng hoa (SameColor)**: 10 lá bài cùng màu (toàn bộ màu đỏ hoặc toàn bộ màu đen).
4. **5 đôi (FivePairs)**: Bài có 5 đôi bất kỳ.
5. **Chỉ từ 3 đến 9 (Range3to9)**: Tất cả 10 lá bài chỉ có giá trị từ 3 đến 9 (không có J, Q, K, A, 2).

*Lưu ý: Nếu có nhiều người cùng đạt điều kiện tới trắng, người nào ở vị trí sớm hơn trong vòng chơi (tính từ Starter) sẽ được ưu tiên thắng.*

---

## 4. Vòng Quyết Định Báo Sâm (Sâm Announce Phase)
Nếu không có ai Tới Trắng, ván đấu bước vào giai đoạn báo Sâm:
- **Quyết định đồng thời**: Tất cả mọi người chơi trong bàn đều có thể đồng thời ấn quyết định **Báo Sâm** hoặc **Không báo Sâm** trong thời gian giới hạn (15 giây).
- **Trạng thái chờ**: Khi một người chơi đã đưa ra quyết định nhưng các người chơi khác chưa chọn xong, giao diện của họ sẽ hiển thị trạng thái **"Chờ người chơi khác..."** và nhãn trạng thái dưới ảnh đại diện đổi sang màu xanh biển **"CHỜ NGƯỜI KHÁC"**.
- **Giải quyết phase khi hết giờ hoặc mọi người chọn xong**:
  - Quyết định được phân định theo vòng chiều kim đồng hồ bắt đầu từ **Người đi đầu (Starter)**.
  - Người đầu tiên chọn **Báo Sâm** tính từ vòng Starter sẽ được chấp nhận báo sâm, nhận quyền đi đầu và bắt đầu ván đấu.
  - Nếu tất cả người chơi đều chọn **Không báo Sâm** (hoặc hết thời gian đếm ngược mà không ai báo), ván đấu bắt đầu bình thường với lượt đi thuộc về **Người đi đầu (Starter)**.

---

## 5. Luật Đánh Bài & Chặn Bài (Card Play Phase)
- Độ mạnh của các quân bài sắp xếp theo giá trị tăng dần: `3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A, 2` (Quân Heo/2 là lớn nhất). Chất bài (`♠, ♣, ♦, ♥`) không xét độ mạnh yếu, chỉ so sánh độ mạnh bằng giá trị số của quân bài.
- Các bộ bài hợp lệ (Combination Types):
  - **Rác (Single)**: 1 quân bài đơn lẻ.
  - **Đôi (Pair)**: 2 quân bài cùng giá trị số.
  - **Ba (Triple)**: 3 quân bài cùng giá trị số.
  - **Tứ quý (Quad)**: 4 quân bài cùng giá trị số.
  - **Sảnh (Straight)**: Bộ từ 3 quân bài trở lên có giá trị số liên tiếp. Sảnh đặc biệt chấp nhận dây `A-2-3` (quân 2 được tính là giá trị nhỏ nhất). Quân 2 không được nằm trong sảnh thường khác (ví dụ: `Q-K-A-2` là không hợp lệ).
- **Quy tắc chặn bài (Blocking Rules)**:
  - Quân/bộ chặn phải cùng kiểu kết hợp và cùng số lượng lá bài (ví dụ: Đôi chặn Đôi, Sảnh 3 lá chặn Sảnh 3 lá) và có **quân lớn nhất lớn hơn quân lớn nhất của bộ trước đó**.
  - **Quy tắc đặc biệt**: **Tứ quý (Quad)** có thể chặn được **1 quân Heo (2/Single Heo)**.
  - **Chặn Sâm (Sâm Block)**: Trong ván đấu có người báo Sâm, nếu bất kỳ người chơi nào khác chặn được bộ bài của người báo Sâm dù chỉ 1 lần, ván đấu kết thúc ngay lập tức và người chặn bài đó thắng cuộc luôn (được ăn phạt đền sâm từ người báo Sâm).
- **Bỏ lượt (Pass)**:
  - Nếu người chơi bỏ lượt, họ sẽ không được quyền chặn bài trong suốt vòng đánh đó cho đến khi vòng chơi được reset (khi tất cả những người chơi khác đều bỏ lượt và lượt chơi quay lại người vừa đánh bộ bài lớn nhất).
- **Không được đánh 2 cuối cùng (No 2 Last)**:
  - Người chơi **không được phép đánh quân Heo (2) (hoặc bất kỳ bộ bài nào chứa quân 2)** làm lá bài cuối cùng để giành chiến thắng ván đấu (hết bài).
  - Nếu bài trên tay người chơi **chỉ còn duy nhất quân 2 (hoặc toàn bộ là quân 2)**, họ không được phép đánh mà chỉ có thể chọn **Bỏ Lượt (Pass)** để chuyển quyền đi cho người tiếp theo (kể cả khi họ đang cầm cái). Trình chơi tự động (auto play) khi hết giờ cũng sẽ tự động bỏ lượt nếu rơi vào trường hợp này.

---

## 6. Kết Thúc Ván Đấu & Tính Điểm Gold
Ván đấu kết thúc khi có một người đánh hết bài trên tay (hoặc thắng do Tới Trắng). 

Khi ván đấu kết thúc, hệ thống sẽ tự động thực hiện:
1. **Lật bài người chơi**: Bài của các người chơi còn lại sẽ được lật mở và hiển thị trực tiếp trên bàn đấu trong **5 giây** để tất cả người chơi cùng xem.
2. **Hiệu ứng kết quả trên Avatar**: Không hiển thị hộp thoại popup thông báo kết quả. Thay vào đó, kết quả thắng/thua, số Gold nhận được/khấu trừ và lý do (Ví dụ: `🎉 +30,000 (Thắng)`, `💸 -15,000 (Cóng)`) sẽ nổi trực tiếp thành các bong bóng chat trên avatar của từng người chơi.
3. **Chuẩn bị ván mới**: Hết 5 giây lật bài, bàn đấu được dọn sạch và nút "Sẵn Sàng" hoặc "Bắt Đầu" sẽ xuất hiện trở lại để sẵn sàng cho ván tiếp theo.

Điểm Gold phạt được tính như sau:

### Trường hợp ván đấu Báo Sâm:
- **Báo Sâm thành công**: Người thắng cuộc nhận được từ mỗi người chơi hoạt động khác:
  `Số Gold thắng = 20 * bet`
- **Báo Sâm thất bại (Đền Sâm)**: Nếu người báo sâm bị người khác chặn bài dù chỉ 1 lần, ván đấu kết thúc ngay lập tức. Người báo Sâm phải đền cho người chặn:
  `Số Gold đền = 20 * bet * (số người chơi hoạt động khác)`
  *(Các người chơi khác không mất Gold).*

### Trường hợp ván đấu thông thường (Không báo Sâm):
Người thắng cuộc được cộng tổng số Gold phạt thu từ những người thua:
- **Người thua bị Cóng (còn nguyên 10 lá bài trên tay)**:
  `Số Gold phạt = (15 + số quân Heo thối * 5) * bet`
- **Người thua thông thường**:
  `Số Gold phạt = (số quân bài còn lại + số quân Heo thối * 5) * bet`

### Phạt Chặn Giữa Trận (Tứ quý chặn Heo):
Khi một người chơi đánh 2 (Heo) hoặc Tứ quý mà bị chặn, tiền phạt sẽ được chuyển khoản trực tiếp ngay trong ván đấu:
- **Tứ quý chặn Heo (2)**: Người chơi Heo bị phạt `10 * bet` chuyển sang cho người chặn.
- **Tứ quý đè Tứ quý (chồng tiếp)**: Người chơi Tứ quý trước bị phạt nhân đôi `20 * bet` chuyển sang cho người chặn sau.

### Phạt Thoát Game Giữa Trận (Mid-Game Escape):
Khi ván đấu đang diễn ra (`RoomStatus::Playing`) mà có người chơi thoát hoặc mất kết nối:
- **Phòng 2 người chơi**: Người thoát bị xử thua cuộc luôn. Người còn lại thắng cuộc ngay lập tức và được cộng toàn bộ số tiền phạt thoát của đối thủ (`15 * bet`, hoặc `20 * bet` nếu đang trong giai đoạn báo Sâm).
- **Phòng 3-4 người chơi**: Người thoát bị phạt trừ tiền thoát (`15 * bet` hoặc `20 * bet` nếu đang trong giai đoạn báo Sâm). Tiền phạt này được chia đều và cộng trực tiếp cho tất cả những người chơi còn lại trong phòng. Ván đấu tiếp tục diễn ra bình thường, lượt chơi của người đã thoát sẽ được tự động bỏ qua.
