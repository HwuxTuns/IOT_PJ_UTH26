# ☀️ IoT Solar Panel Monitoring System

Hệ thống giám sát và điều khiển tấm pin năng lượng mặt trời qua web, kết nối Arduino UNO (Proteus) với Dashboard real-time.

## 🏗️ Kiến trúc

```
Arduino (Proteus COMPIM) → Serial → Python Bridge → Node.js API → MySQL
                                                        ↕ WebSocket
                                                   Web Dashboard
```

## 📁 Cấu trúc thư mục

```
├── arduino/              # Code Arduino IDE (.ino)
├── backend/              # Node.js API server (MVC)
│   ├── src/
│   │   ├── config/       # Database config
│   │   ├── controllers/  # Panel, Reading, Status
│   │   ├── middleware/    # Auth, Validation, Error, Logger
│   │   ├── models/       # SolarPanel, SensorReading, DeviceStatus
│   │   ├── routes/       # REST API endpoints
│   │   ├── services/     # Arduino, WebSocket, Aggregation, Logger
│   │   ├── app.js        # Express config
│   │   └── server.js     # Entry point
│   ├── .env.example      # Template config
│   ├── Dockerfile
│   └── package.json
├── css/                  # Dashboard styles
├── js/                   # Dashboard logic (Chart.js, WebSocket)
├── bridge.py             # Python serial bridge (Proteus ↔ Backend)
├── index.html            # Dashboard entry point
├── init-db.sql           # Database schema
├── docker-compose.yml    # MySQL + Backend containers
└── IOT_setup.md          # Tài liệu thiết kế chi tiết
```

## 🚀 Cách chạy

### 1. Cài đặt

```bash
cd backend
cp .env.example .env     # Sửa config nếu cần
npm install
```

### 2. Database (chọn 1)

- **Docker**: `docker-compose up -d mysql`
- **XAMPP**: Start MySQL → phpMyAdmin → Import `init-db.sql`

### 3. Virtual Serial Port

- Cài [VSPE](https://eterlogic.com/Products.VSPE.html) → tạo cặp **COM3 ↔ COM4**

### 4. Proteus

- Load mạch + file `.hex` từ Arduino IDE → COMPIM set **COM3** → Play ▶️

### 5. Khởi chạy

```bash
# Terminal 1: Backend
cd backend && node src/server.js

# Terminal 2: Python Bridge (kết nối serial)
pip install pyserial requests
python bridge.py
```

### 6. Dashboard

Mở trình duyệt: **http://localhost:5000**

## 🔌 API Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/health` | Kiểm tra trạng thái hệ thống |
| GET | `/api/readings/latest/:panelId` | Đọc mới nhất từ DB |
| GET | `/api/readings/daily/:panelId` | Data biểu đồ ngày |
| GET | `/api/readings/history?panelId=X&days=N` | Lịch sử đo lường |
| POST | `/api/control/servo` | Điều khiển servo `{ "angle": 90 }` |
| GET | `/api/realtime/latest/:panelId` | Data real-time từ buffer |

## 👥 Team

> Thêm thông tin team vào đây.

## 📄 License

MIT
