# Hệ Thống Giám Sát Tấm Pin Năng Lượng Mặt Trời - IOT_setup.md

## 📋 Mục Lục

1. [Frontend Architecture](#frontend-architecture)
2. [Backend MVC Architecture](#backend-mvc-architecture)
3. [Database Schema](#database-schema)
4. [Docker Compose Configuration](#docker-compose-configuration)
5. [Integration Guide](#integration-guide)
6. [Authentication & Security](#authentication--security)
7. [Real-time Communication (WebSocket)](#real-time-communication-websocket)
8. [Logging & Monitoring](#logging--monitoring)
9. [Testing Strategy](#testing-strategy)
10. [Environment Variables Guide](#environment-variables-guide)

---

## Frontend Architecture

### 🎯 Tổng Quan

Frontend là **Vanilla JavaScript Admin Dashboard** (Adminator 4.0) tùy chỉnh cho IoT Solar Monitoring System. Không dùng framework, chỉ dùng native JS, CSS variables, và Chart.js.

**Đặc điểm**:
- No jQuery / No Bootstrap / No React
- Token-driven CSS variables (light/dark theme)
- Real-time data updates từ Backend API
- Responsive grid layout (12 columns)

### 📁 4 File Frontend Đã Sửa

#### 1. **src/index.html** - Dashboard Main Page (277 lines)

**Cấu trúc**:
```html
<!-- Hero Section -->
<section class="solar-hero">
  <h1>Hệ thống giám sát tấm pin năng lượng mặt trời</h1>
  <div class="status-pills">
    <span class="status-pill is-online">Online</span>
    <span class="status-pill is-charging">Đang sạc</span>
    <span class="status-pill is-sun">Ánh sáng tốt</span>
  </div>
</section>

<!-- 4 KPI Cards -->
<section class="solar-kpis">
  <div class="kpi-pill">
    <span class="kpi-label">Mã Tấm Pin</span>
    <span class="kpi-value">PANEL-001</span>
  </div>
  <!-- x3 more: Voltage, Current, Power -->
</section>

<!-- Grid: 5 content sections -->
<section class="grid">
  <div class="col-8">Daily Power Chart (Line)</div>
  <div class="col-4">System Status (Doughnut)</div>
  <div class="col-6">Weekly Energy (Bar)</div>
  <div class="col-6">Device Info Table</div>
  <div class="col-12">History Table + Filters</div>
</section>
```

**Điểm chính**:
- 12-column grid system: col-8/col-4, col-6/col-6, col-12
- `data-chart-key` attributes → chart rendering
- `data-filter` attributes → date range filtering
- Shell wrapper (sidebar/topbar/footer) từ Shell.js

---

#### 2. **src/assets/scripts/2026/charts.js** - Chart Seeds (+69 lines)

**3 Biểu đồ mới**:

```javascript
SEEDS = {
  'solar-live-day': (t) => ({
    type: 'line',
    data: {
      labels: Array(24).fill(0).map((_, i) => i + ':00'),
      datasets: [{
        label: 'Công Suất (W)',
        data: [0,0,0,12,38,68,104,118,112,78,24,6,...],
        borderColor: t.primary,
        backgroundColor: `${t.primary}18`,
        tension: 0.38
      }]
    }
  }),

  'solar-weekly': (t) => ({
    type: 'bar',
    data: {
      labels: ['T2','T3','T4','T5','T6','T7','CN'],
      datasets: [{
        label: 'Năng Lượng (kWh)',
        data: [4.2,5.1,4.8,6.3,6.8,7.4,5.9],
        backgroundColor: [t.primary, t.success, t.danger, ...]
      }]
    }
  }),

  'solar-status': (t) => ({
    type: 'doughnut',
    data: {
      labels: ['Đang Sạc', 'Đầy', 'Lỗi'],
      datasets: [{
        data: [68, 27, 5],
        backgroundColor: [t.primary, t.success, t.danger]
      }]
    },
    options: { cutout: '70%' }
  })
}
```

**Cơ chế**: 
- `getTokens()` đọc CSS variables từ `:root[data-theme]`
- Auto re-render khi theme thay đổi via MutationObserver
- `document.querySelectorAll('[data-chart-key]')` → render canvas

---

#### 3. **src/assets/styles/2026/_components.scss** - Grid Utilities (+2 lines)

```scss
.col-4 { grid-column: span 4; }   // 33.33%
.col-8 { grid-column: span 8; }   // 66.67%
```

---

#### 4. **src/assets/styles/2026/_dashboard.scss** - Solar Styling (+152 lines)

**Components**:

| Class | Purpose | Notes |
|-------|---------|-------|
| `.solar-hero` | Hero section wrapper | flexbox column, 14px gap |
| `.status-pill` | Status badges | 3 variants: is-online/is-charging/is-sun |
| `.solar-kpis` | KPI override | 40px value font, gray background |
| `.solar-chart-wrap` | Chart containers | gradient bg, border, 12px padding |
| `.chip` | Filter buttons | toggle state: is-active |
| `.solar-history-table` | History table | nowrap for dates |
| `.solar-info-table` | Device info table | 50/50 layout, monospace values |

**CSS Variables sử dụng**:
```scss
--primary, --success, --danger, --warning, --info
--text-primary, --text-secondary
--bg-base, --bg-secondary, --bg-tertiary
--border-color
```

---

## Backend MVC Architecture

### 📁 Cấu Trúc Thư Mục

```
backend/
├── src/
│   ├── models/
│   │   ├── SolarPanel.js          // Entity: Panel info
│   │   ├── SensorReading.js       // Entity: Sensor data
│   │   └── DeviceStatus.js        // Entity: Device state
│   │
│   ├── controllers/
│   │   ├── panelController.js     // CRUD panels
│   │   ├── readingController.js   // Save/fetch readings
│   │   └── statusController.js    // Manage status
│   │
│   ├── routes/
│   │   └── index.js               // API endpoints
│   │
│   ├── services/
│   │   ├── arduinoService.js      // Serial communication
│   │   ├── dataParsingService.js  // Parse sensor data
│   │   └── alertService.js        // Generate alerts
│   │
│   ├── middleware/
│   │   ├── errorHandler.js
│   │   └── validationMiddleware.js
│   │
│   ├── app.js                     // Express app
│   └── server.js                  // Entry point
│
├── .env
├── package.json
├── Dockerfile
└── docker-compose.yml
```

### 1️⃣ Models

```javascript
// SolarPanel - Thông tin tấm pin
class SolarPanel {
  panelId = 'PANEL-001';           // Unique ID
  location = 'Rooftop A';          // Vị trí
  angle = 45;                      // Góc servo (degrees)
  status = 'active|inactive|error';
  createdAt = new Date();
}

// SensorReading - Dữ liệu cảm biến
class SensorReading {
  panelId = 'PANEL-001';
  voltage = 18.5;                  // Volts
  current = 5.2;                   // Amps
  power = voltage * current;       // Watts (calculated)
  lightIntensity = 4500;           // Lux
  chargeTime = 45;                 // Minutes
  timestamp = new Date();
}

// DeviceStatus - Trạng thái thiết bị
class DeviceStatus {
  panelId = 'PANEL-001';
  state = 'charging|full|error';
  errorCode = 'ERR_001';           // Optional
  errorMessage = 'Battery low';    // Optional
  timestamp = new Date();
}
```

### 2️⃣ Controllers

```javascript
// panelController.js
class PanelController {
  // GET /api/panels
  async getAllPanels(req, res, next) {
    try {
      const panels = await db.query('SELECT * FROM solar_panels');
      res.json({ success: true, data: panels });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/panels/:panelId
  async getPanelDetail(req, res, next) {
    try {
      const panel = await db.query(
        'SELECT * FROM solar_panels WHERE panel_id = ?',
        [req.params.panelId]
      );
      res.json({ success: true, data: panel });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/panels
  async createPanel(req, res, next) {
    try {
      const { panelId, location } = req.body;
      await db.query(
        'INSERT INTO solar_panels (panel_id, location) VALUES (?, ?)',
        [panelId, location]
      );
      res.status(201).json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

// readingController.js
class ReadingController {
  // GET /api/readings/latest/:panelId (for KPI display)
  async getLatestReading(req, res, next) {
    try {
      const reading = await db.query(
        `SELECT voltage, current, power, light_intensity, charge_time
         FROM sensor_readings
         WHERE panel_id = ?
         ORDER BY created_at DESC LIMIT 1`,
        [req.params.panelId]
      );
      res.json({ success: true, data: reading });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/readings (save from Arduino)
  async createReading(req, res, next) {
    try {
      const { panelId, voltage, current, lightIntensity, chargeTime } = req.body;
      // power is auto-calculated by DB generated column
      await db.query(
        `INSERT INTO sensor_readings 
         (panel_id, voltage, current, light_intensity, charge_time)
         VALUES (?, ?, ?, ?, ?)`,
        [panelId, voltage, current, lightIntensity, chargeTime]
      );
      res.status(201).json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/readings/daily/:panelId (for chart)
  async getDailyReadings(req, res, next) {
    try {
      const readings = await db.query(
        `SELECT reading_hour as hour, AVG(power) as avg_power
         FROM sensor_readings
         WHERE panel_id = ? AND reading_date = CURDATE()
         GROUP BY reading_hour
         ORDER BY hour ASC`,
        [req.params.panelId]
      );
      
      const chartData = Array(24).fill(0);
      readings.forEach(r => { chartData[r.hour] = r.avg_power; });
      
      res.json({ success: true, data: chartData });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/readings/weekly/:panelId
  async getWeeklyReadings(req, res, next) {
    try {
      // SENSOR_INTERVAL = seconds between each reading (default 10s)
      const INTERVAL_S = parseInt(process.env.SENSOR_INTERVAL || '10');
      const readings = await db.query(
        `SELECT reading_date,
                SUM(power * ${INTERVAL_S}) / 3600 / 1000 AS kwh
         FROM sensor_readings
         WHERE panel_id = ? AND reading_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
         GROUP BY reading_date
         ORDER BY reading_date ASC`,
        [req.params.panelId]
      );
      
      const kwhData = readings.map(r => parseFloat(r.kwh).toFixed(1));
      res.json({ success: true, data: kwhData });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/readings/history?panelId=X&days=7 (for table)
  async getHistory(req, res, next) {
    try {
      const { panelId, days = 1 } = req.query;
      const history = await db.query(
        `SELECT * FROM sensor_readings
         WHERE panel_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         ORDER BY created_at DESC`,
        [panelId, parseInt(days)]
      );
      res.json({ success: true, data: history });
    } catch (error) {
      next(error);
    }
  }
}

// statusController.js
class StatusController {
  // GET /api/status/:panelId
  async getStatus(req, res, next) {
    try {
      const status = await db.query(
        `SELECT state, error_code, error_message
         FROM device_status
         WHERE panel_id = ?
         ORDER BY created_at DESC LIMIT 1`,
        [req.params.panelId]
      );
      res.json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/status
  async updateStatus(req, res, next) {
    try {
      const { panelId, state, errorCode, errorMessage } = req.body;
      await db.query(
        `INSERT INTO device_status (panel_id, state, error_code, error_message)
         VALUES (?, ?, ?, ?)`,
        [panelId, state, errorCode, errorMessage]
      );
      res.status(201).json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/status/system/overview (for doughnut chart)
  async getSystemOverview(req, res, next) {
    try {
      // Only count the LATEST status of each panel (not all historical records)
      const stats = await db.query(
        `SELECT state, COUNT(*) as cnt FROM (
           SELECT panel_id, state,
             ROW_NUMBER() OVER (PARTITION BY panel_id ORDER BY created_at DESC) as rn
           FROM device_status
         ) t WHERE rn = 1
         GROUP BY state`
      );
      
      const result = { charging: 0, full: 0, errors: 0 };
      let total = 0;
      stats.forEach(row => {
        result[row.state === 'error' ? 'errors' : row.state] = row.cnt;
        total += row.cnt;
      });
      
      if (total === 0) total = 1; // avoid division by zero
      
      res.json({
        success: true,
        data: {
          charging: ((result.charging / total) * 100).toFixed(0),
          full: ((result.full / total) * 100).toFixed(0),
          errors: ((result.errors / total) * 100).toFixed(0)
        }
      });
    } catch (error) {
      next(error);
    }
  }
}
```

### 3️⃣ Routes

```javascript
// routes/index.js
const router = express.Router();

// Panel endpoints
router.get('/panels', panelController.getAllPanels);
router.get('/panels/:panelId', panelController.getPanelDetail);
router.post('/panels', panelController.createPanel);

// Reading endpoints
router.get('/readings/latest/:panelId', readingController.getLatestReading);
router.post('/readings', readingController.createReading);
router.get('/readings/daily/:panelId', readingController.getDailyReadings);
router.get('/readings/weekly/:panelId', readingController.getWeeklyReadings);
router.get('/readings/history', readingController.getHistory);

// Status endpoints (specific routes BEFORE parameterized routes)
router.get('/status/system/overview', statusController.getSystemOverview);
router.get('/status/:panelId', statusController.getStatus);
router.post('/status', statusController.updateStatus);

module.exports = router;
```

### 4️⃣ Arduino Service

```javascript
// services/arduinoService.js
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const fetch = require('node-fetch'); // or use axios

class ArduinoService {
  constructor() {
    this.port = null;
    this.parser = null;
    this.baudRate = 9600;
    this.portPath = process.env.ARDUINO_PORT || 'COM3';
    this.reconnectInterval = 5000; // 5s retry
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.port = new SerialPort({
        path: this.portPath,
        baudRate: this.baudRate
      });

      // Use ReadlineParser to handle data buffering (read complete lines)
      this.parser = this.port.pipe(
        new ReadlineParser({ delimiter: '\n' })
      );

      this.port.on('open', () => {
        console.log('Arduino connected on', this.portPath);
        this.listenToData();
        resolve();
      });

      this.port.on('error', (err) => {
        console.error('Serial port error:', err.message);
        reject(err);
      });

      // Auto-reconnect on disconnect
      this.port.on('close', () => {
        console.warn('Arduino disconnected. Reconnecting in 5s...');
        setTimeout(() => this.connect(), this.reconnectInterval);
      });
    });
  }

  listenToData() {
    // parser emits complete lines (no more partial data chunks)
    this.parser.on('data', async (line) => {
      try {
        const sensorData = this.parseData(line);
        if (sensorData) {
          await this.saveSensorReading(sensorData);
        }
      } catch (error) {
        console.error('Error processing sensor data:', error.message);
      }
    });
  }

  // Parse format: "PANEL-001|18.5|5.2|4500|45"
  parseData(line) {
    const parts = line.toString().trim().split('|');
    if (parts.length < 5) return null;
    
    return {
      panelId: parts[0],
      voltage: parseFloat(parts[1]),
      current: parseFloat(parts[2]),
      lightIntensity: parseInt(parts[3]),
      chargeTime: parseInt(parts[4])
    };
  }

  // Save sensor reading via internal API call
  async saveSensorReading(data) {
    const res = await fetch('http://localhost:5000/api/readings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      throw new Error(`Failed to save reading: HTTP ${res.status}`);
    }
  }

  async sendCommand(command) {
    return new Promise((resolve, reject) => {
      this.port.write(command + '\n', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async setServoAngle(angle) {
    await this.sendCommand(`SERVO:${angle}`);
  }
}

module.exports = new ArduinoService();
```

---

### 5️⃣ Validation Middleware

```javascript
// middleware/validationMiddleware.js

// Validate panelId format: PANEL-001, PANEL-999, etc.
const validatePanelId = (req, res, next) => {
  const panelId = req.params.panelId || req.body.panelId || req.query.panelId;
  if (panelId && !/^PANEL-\d{3}$/.test(panelId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid panelId format. Expected: PANEL-XXX (e.g., PANEL-001)'
    });
  }
  next();
};

// Validate sensor reading data ranges
const validateReading = (req, res, next) => {
  const { voltage, current, lightIntensity, chargeTime } = req.body;
  const errors = [];

  if (voltage !== undefined && (voltage < 0 || voltage > 100)) {
    errors.push('voltage must be between 0 and 100 V');
  }
  if (current !== undefined && (current < 0 || current > 50)) {
    errors.push('current must be between 0 and 50 A');
  }
  if (lightIntensity !== undefined && (lightIntensity < 0 || lightIntensity > 100000)) {
    errors.push('lightIntensity must be between 0 and 100000 lux');
  }
  if (chargeTime !== undefined && (chargeTime < 0 || chargeTime > 1440)) {
    errors.push('chargeTime must be between 0 and 1440 minutes');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }
  next();
};

// Validate query params for history endpoint
const validateHistoryQuery = (req, res, next) => {
  const { days } = req.query;
  if (days !== undefined) {
    const parsed = parseInt(days);
    if (isNaN(parsed) || parsed < 1 || parsed > 365) {
      return res.status(400).json({
        success: false,
        error: 'days must be an integer between 1 and 365'
      });
    }
  }
  next();
};

// Validate device status state
const validateStatus = (req, res, next) => {
  const { state } = req.body;
  const validStates = ['charging', 'full', 'error'];
  if (state && !validStates.includes(state)) {
    return res.status(400).json({
      success: false,
      error: `state must be one of: ${validStates.join(', ')}`
    });
  }
  next();
};

module.exports = {
  validatePanelId,
  validateReading,
  validateHistoryQuery,
  validateStatus
};
```

**Sử dụng trong Routes**:
```javascript
const { validatePanelId, validateReading, validateHistoryQuery, validateStatus }
  = require('../middleware/validationMiddleware');

// Áp dụng validation vào routes
router.get('/panels/:panelId', validatePanelId, panelController.getPanelDetail);
router.post('/readings', validatePanelId, validateReading, readingController.createReading);
router.get('/readings/history', validatePanelId, validateHistoryQuery, readingController.getHistory);
router.post('/status', validatePanelId, validateStatus, statusController.updateStatus);
```

---

## Database Schema

### 📊 SQL Tables

```sql
-- Table 1: Solar Panels
CREATE TABLE solar_panels (
  id INT PRIMARY KEY AUTO_INCREMENT,
  panel_id VARCHAR(50) UNIQUE NOT NULL,      -- PANEL-001
  location VARCHAR(255),                     -- Rooftop A
  angle INT DEFAULT 45,                      -- Servo angle
  status ENUM('active','inactive','error'),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_panel_id (panel_id),
  INDEX idx_status (status)
);

-- Table 2: Sensor Readings
CREATE TABLE sensor_readings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  panel_id VARCHAR(50) NOT NULL,
  voltage DECIMAL(5,2),              -- 18.50 V
  current DECIMAL(5,2),              -- 5.20 A
  power DECIMAL(8,2) GENERATED ALWAYS AS (voltage * current) STORED,  -- 96.20 W
  light_intensity INT,               -- lux
  charge_time INT,                   -- minutes
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Generated columns for indexing (MySQL cannot index expressions directly)
  reading_date DATE GENERATED ALWAYS AS (DATE(created_at)) STORED,
  reading_hour TINYINT GENERATED ALWAYS AS (HOUR(created_at)) STORED,
  
  FOREIGN KEY (panel_id) REFERENCES solar_panels(panel_id),
  INDEX idx_panel_created (panel_id, created_at DESC),
  INDEX idx_time_series (panel_id, reading_date, reading_hour)
);

-- Table 3: Device Status
CREATE TABLE device_status (
  id INT PRIMARY KEY AUTO_INCREMENT,
  panel_id VARCHAR(50) NOT NULL,
  state ENUM('charging','full','error'),
  error_code VARCHAR(20),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (panel_id) REFERENCES solar_panels(panel_id),
  INDEX idx_panel_created (panel_id, created_at DESC),
  INDEX idx_state (state)
);

-- Table 4: Alerts
CREATE TABLE alerts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  panel_id VARCHAR(50) NOT NULL,
  severity ENUM('low','medium','high'),
  title VARCHAR(255),
  message TEXT,
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (panel_id) REFERENCES solar_panels(panel_id),
  INDEX idx_resolved (is_resolved)
);
```

---

## Docker Compose Configuration

### 📦 docker-compose.yml

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    env_file: .env
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${DB_NAME}
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASSWORD}
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./init-db.sql:/docker-entrypoint-initdb.d/init-db.sql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    env_file: .env
    environment:
      NODE_ENV: production
      PORT: ${PORT}
      DB_HOST: mysql
      DB_PORT: 3306
      DB_NAME: ${DB_NAME}
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
      ARDUINO_PORT: ${ARDUINO_PORT}
      JWT_SECRET: ${JWT_SECRET}
      CORS_ORIGIN: ${CORS_ORIGIN}
      SENSOR_INTERVAL: ${SENSOR_INTERVAL}
    ports:
      - "${PORT}:${PORT}"
    depends_on:
      mysql:
        condition: service_healthy

  phpmyadmin:
    image: phpmyadmin:latest
    environment:
      PMA_HOST: mysql
      PMA_USER: ${DB_USER}
      PMA_PASSWORD: ${DB_PASSWORD}
    ports:
      - "8080:80"
    profiles:
      - dev   # Only start in dev: docker compose --profile dev up

volumes:
  mysql_data:
```

### 🐳 Dockerfile (Backend)

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src

EXPOSE 5000

CMD ["node", "src/server.js"]
```

### 📋 Backend package.json

```json
{
  "name": "iot-solar-backend",
  "version": "2.0.0",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest --coverage",
    "test:watch": "jest --watch"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mysql2": "^3.6.0",
    "serialport": "^9.2.8",
    "@serialport/parser-readline": "^11.0.0",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.4",
    "ws": "^8.14.2",
    "winston": "^3.11.0",
    "node-fetch": "^2.7.0"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^6.3.3",
    "nodemon": "^3.0.2"
  }
}
```

---

## Integration Guide

### 🔌 Frontend ↔ Backend Communication Flow

**Data Flow Diagram**:
```
Arduino/Sensor
    ↓ (Serial: panelId|V|A|lux|time)
COMPIM Module
    ↓
ArduinoService.listenToData() via ReadlineParser
    ↓
parseData() → { panelId, voltage, current, ... }
    ↓
POST /api/readings → ReadingController
    ↓
INSERT sensor_readings
    ↓
┌───────────────────────────────────────────────┐
│  WebSocket broadcast (ws://localhost:5000/ws)  │
│  → Real-time push to all connected clients      │
└───────────────────────────────────────────────┘
    ↓
Frontend: WebSocket client receives new reading
    ↓
Update Dashboard KPIs & Charts Real-time
    (Fallback: REST polling every 30s if WS disconnected)
```

### 📱 REST API Endpoints Summary

| Method | Endpoint | Response | Frontend Use |
|--------|----------|----------|--------------|
| GET | `/api/readings/latest/:panelId` | `{voltage, current, power, ...}` | KPI cards |
| GET | `/api/readings/daily/:panelId` | `[0,0,12,38,...]` (24 points) | Daily chart |
| GET | `/api/readings/weekly/:panelId` | `[4.2,5.1,...]` (7 days) | Weekly chart |
| GET | `/api/readings/history?panelId=X&days=7` | History array | Table |
| GET | `/api/status/system/overview` | `{charging%, full%, error%}` | Doughnut chart |
| POST | `/api/readings` | Save from Arduino | Backend receives |

### 💻 Frontend Fetching Examples

```javascript
// === Utility: Safe fetch with error handling ===
async function safeFetch(url, options = {}) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'API error');
    return json.data;
  } catch (err) {
    console.error(`Fetch failed [${url}]:`, err.message);
    showErrorToast(`Kết nối thất bại: ${err.message}`);
    return null;
  }
}

// === WebSocket: Real-time updates (primary) ===
let ws = null;
let fallbackTimer = null;

function connectWebSocket() {
  ws = new WebSocket(`ws://${location.host}/ws`);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
    document.querySelector('.status-pill.is-online').classList.add('active');
    if (fallbackTimer) clearInterval(fallbackTimer); // stop polling
  };
  
  ws.onmessage = (event) => {
    const { type, data } = JSON.parse(event.data);
    if (type === 'new-reading') updateKPI(data);
    if (type === 'status-change') updateStatus(data);
  };
  
  ws.onclose = () => {
    console.warn('WebSocket disconnected. Fallback to polling...');
    document.querySelector('.status-pill.is-online').classList.remove('active');
    fallbackTimer = setInterval(loadKPI, 30000); // fallback polling
    setTimeout(connectWebSocket, 5000);           // auto-reconnect
  };
}
connectWebSocket();

// === KPI: Update display ===
function updateKPI(data) {
  if (!data) return;
  document.querySelector('[data-kpi="voltage"]').textContent = data.voltage + 'V';
  document.querySelector('[data-kpi="current"]').textContent = data.current + 'A';
  document.querySelector('[data-kpi="power"]').textContent = data.power + 'W';
}

async function loadKPI() {
  const data = await safeFetch('/api/readings/latest/PANEL-001');
  updateKPI(data);
}

// === Chart: Load on page load ===
async function loadChart() {
  const data = await safeFetch('/api/readings/daily/PANEL-001');
  if (data) { /* Render chart with data */ }
}

// === Table: Load with filter ===
async function loadHistory(days = 1) {
  const data = await safeFetch(
    `/api/readings/history?panelId=PANEL-001&days=${days}`
  );
  if (data) { /* Populate table rows */ }
}

// === Error Toast ===
function showErrorToast(message) {
  const toast = document.createElement('div');
  toast.className = 'error-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}
```

---

## Deployment Checklist

- [ ] `.env` file created from `.env.example`
- [ ] MySQL database initialized (init-db.sql ran)
- [ ] Backend Docker image built successfully
- [ ] Arduino serial port configured (COM3 or /dev/ttyUSB0)
- [ ] `docker-compose up -d` executed
- [ ] JWT_SECRET set to a strong random value
- [ ] CORS_ORIGIN set to frontend URL
- [ ] API endpoints tested with curl/Postman
- [ ] WebSocket connection verified (ws://localhost:5000/ws)
- [ ] Frontend real-time updates working via WebSocket
- [ ] Fallback polling working when WebSocket disconnects
- [ ] Charts rendering with real data
- [ ] Responsive design tested on mobile
- [ ] Dark/light theme toggle working
- [ ] Rate limiting tested (POST endpoints)
- [ ] `npm test` passes all tests

---

## File Dependencies

**Frontend**:
- `index.html` → uses chart `data-chart-key` attributes
- `charts.js` → reads CSS variables from `_tokens.scss`
- `_dashboard.scss` → uses utility classes from `_components.scss`
- `init.js` → listens to `data-filter` attributes

**Backend**:
- `controllers/` → depends on database connection
- `arduinoService.js` → setup serial port before starting
- `routes/` → mounted on Express app in `app.js`

**Database**:
- `init-db.sql` → runs automatically on container startup
- All tables created with proper indexes and foreign keys

---

## Authentication & Security

### 🔐 JWT Middleware

```javascript
// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]; // Bearer <token>
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access denied. No token provided.'
    });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({
      success: false,
      error: 'Invalid or expired token.'
    });
  }
};

// Optional: only protect write endpoints
const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try { req.user = jwt.verify(token, process.env.JWT_SECRET); }
    catch (e) { /* ignore invalid token for GET requests */ }
  }
  next();
};

module.exports = { authMiddleware, optionalAuth };
```

### 🛡️ Security Setup in `app.js`

```javascript
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

// Security headers
app.use(helmet());

// CORS - restrict to frontend origin only
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting for POST endpoints (max 100 req / 15 min)
const postLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: 'Too many requests. Try again later.' }
});
app.use('/api/readings', postLimiter);
app.use('/api/status', postLimiter);

// Apply auth to protected routes
const { authMiddleware } = require('./middleware/authMiddleware');
app.post('/api/panels', authMiddleware, panelController.createPanel);
app.post('/api/readings', authMiddleware, readingController.createReading);
app.post('/api/status', authMiddleware, statusController.updateStatus);
```

---

## Real-time Communication (WebSocket)

### 📡 WebSocket Server

```javascript
// services/websocketService.js
const { WebSocketServer } = require('ws');

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Set();
  }

  init(server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      console.log(`WS client connected (total: ${this.clients.size})`);

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', (err) => {
        console.error('WS error:', err.message);
        this.clients.delete(ws);
      });
    });
  }

  // Broadcast new sensor reading to all connected clients
  broadcastReading(data) {
    const msg = JSON.stringify({ type: 'new-reading', data });
    this.clients.forEach(c => {
      if (c.readyState === 1) c.send(msg);
    });
  }

  // Broadcast status change
  broadcastStatus(data) {
    const msg = JSON.stringify({ type: 'status-change', data });
    this.clients.forEach(c => {
      if (c.readyState === 1) c.send(msg);
    });
  }
}

module.exports = new WebSocketService();
```

### 🔗 Integration in `server.js`

```javascript
const http = require('http');
const app = require('./app');
const wsService = require('./services/websocketService');

const server = http.createServer(app);
wsService.init(server);

server.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
```

---

## Logging & Monitoring

### 📋 Winston Logger

```javascript
// services/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880,  // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 10
    })
  ]
});

module.exports = logger;
```

### 📊 Request Logging Middleware

```javascript
// middleware/requestLogger.js
const logger = require('../services/logger');

const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration: `${Date.now() - start}ms`,
      ip: req.ip
    });
  });
  next();
};

module.exports = requestLogger;
```

### ❤️ Health Endpoint

```javascript
// GET /api/health
router.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({
      success: true,
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: '2.0.0'
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: 'Database connection failed'
    });
  }
});
```

---

## Testing Strategy

### 🧪 API Test Example (Jest + Supertest)

```javascript
// __tests__/controllers/readingController.test.js
const request = require('supertest');
const app = require('../../src/app');

describe('GET /api/readings/latest/:panelId', () => {
  it('should return latest reading', async () => {
    const res = await request(app)
      .get('/api/readings/latest/PANEL-001');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('voltage');
  });

  it('should reject invalid panelId', async () => {
    const res = await request(app)
      .get('/api/readings/latest/INVALID');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/readings', () => {
  it('should reject voltage out of range', async () => {
    const res = await request(app)
      .post('/api/readings')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ panelId: 'PANEL-001', voltage: 999, current: 5.2,
              lightIntensity: 4500, chargeTime: 45 });

    expect(res.status).toBe(400);
  });
});
```

### 🔌 Mock Serial Port

```javascript
// __tests__/services/arduinoService.test.js
jest.mock('serialport');

describe('ArduinoService.parseData', () => {
  const service = require('../../src/services/arduinoService');

  it('should parse valid data', () => {
    const result = service.parseData('PANEL-001|18.5|5.2|4500|45');
    expect(result).toEqual({
      panelId: 'PANEL-001', voltage: 18.5,
      current: 5.2, lightIntensity: 4500, chargeTime: 45
    });
  });

  it('should return null for incomplete data', () => {
    expect(service.parseData('PANEL-001|18.5')).toBeNull();
  });
});
```

---

## Environment Variables Guide

### 📄 `.env.example`

```env
# === Server ===
PORT=5000
NODE_ENV=development

# === Database ===
MYSQL_ROOT_PASSWORD=change_me_root
DB_HOST=localhost
DB_PORT=3306
DB_NAME=iot_solar_db
DB_USER=solar_user
DB_PASSWORD=change_me_password

# === Authentication ===
JWT_SECRET=change_me_to_a_64_char_random_string
JWT_EXPIRES_IN=24h

# === Arduino ===
ARDUINO_PORT=COM3
SENSOR_INTERVAL=10

# === CORS ===
CORS_ORIGIN=http://localhost:3000

# === Logging ===
LOG_LEVEL=info
```

> ⚠️ **Quan trọng**: Copy file này thành `.env` và thay đổi tất cả giá trị `change_me_*` trước khi chạy!

---

**Project**: Hệ Thống Giám Sát Tấm Pin Năng Lượng Mặt Trời  
**Created**: April 28, 2026  
**Version**: 2.0.0  
**Tech Stack**: Vanilla JS + Node.js MVC + MySQL 8.0 + Docker + WebSocket + JWT
