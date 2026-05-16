/**
 * Data Aggregation Service
 * 
 * Arduino gửi data mỗi 1 giây → lưu raw vào memory buffer
 * Mỗi phút: tính trung bình → lưu vào DB (sensor_readings)
 * Dashboard nhận real-time qua WebSocket mỗi giây
 */
const db = require('../config/database');
const wsService = require('./websocketService');
const logger = require('./logger');

class AggregationService {
  constructor() {
    // Buffer lưu raw readings trong 1 phút
    this.buffer = {};      // { 'PANEL-001': [ {voltage, current, ...}, ... ] }
    this.lastReading = {};  // Latest reading per panel (for real-time display)
    this.aggregateInterval = null;
    this.lastAlertTime = {}; // Throttle alerts
  }

  /**
   * Start the aggregation timer (save averages every 60 seconds)
   */
  start() {
    // Aggregate every 60 seconds
    this.aggregateInterval = setInterval(() => {
      this._flushBuffer();
    }, 60 * 1000);

    logger.info('Aggregation service started (interval: 60s)');
  }

  /**
   * Stop aggregation
   */
  stop() {
    if (this.aggregateInterval) {
      clearInterval(this.aggregateInterval);
      this.aggregateInterval = null;
    }
  }

  /**
   * Receive a raw reading from Arduino (called every ~1 second)
   * - Stores in buffer for aggregation
   * - Broadcasts immediately to WebSocket for real-time display
   */
  addReading(data) {
    const { panelId } = data;

    // Initialize buffer for this panel
    if (!this.buffer[panelId]) {
      this.buffer[panelId] = [];
    }

    // Add to buffer
    this.buffer[panelId].push({
      voltage: data.voltage,
      current: data.current,
      power: data.power,
      lightIntensity: data.lightIntensity,
      servoAngle: data.servoAngle,
      timestamp: Date.now(),
    });

    // Store as latest reading
    this.lastReading[panelId] = {
      ...data,
      timestamp: new Date().toISOString(),
    };

    // ─── TỰ ĐỘNG KIỂM TRA CẢNH BÁO ───
    this._checkAlerts(data);

    // Broadcast real-time to all WebSocket clients
    wsService.broadcastReading(this.lastReading[panelId]);
  }

  /**
   * Kiểm tra các ngưỡng giới hạn và phát cảnh báo
   */
  _checkAlerts(data) {
    const { panelId, voltage, current, power, lightIntensity } = data;
    const now = Date.now();
    
    if (!this.lastAlertTime[panelId]) this.lastAlertTime[panelId] = 0;
    
    // Giới hạn 10 giây mới thông báo 1 lần cho mỗi panel để tránh spam liên tục
    if (now - this.lastAlertTime[panelId] < 10000) return;

    let alertMsg = null;
    let severity = 'warning'; // 'warning' hoặc 'danger'

    if (voltage > 30) {
      alertMsg = `Quá áp (${voltage.toFixed(1)}V)! Nguy cơ hỏng hệ thống.`;
      severity = 'danger';
    } else if (current > 10) {
      alertMsg = `Quá dòng (${current.toFixed(1)}A)!`;
      severity = 'danger';
    } else if (power > 300) {
      alertMsg = `Quá tải công suất (${power.toFixed(1)}W)!`;
      severity = 'danger';
    } else if (voltage < 5 && lightIntensity > 800) {
      alertMsg = `Điện áp thấp bất thường (${voltage.toFixed(1)}V) khi trời nắng gắt. Pin có thể bị hỏng.`;
      severity = 'warning';
    }

    if (alertMsg) {
      this.lastAlertTime[panelId] = now;
      
      // 1. Gửi qua WebSocket cho Frontend hiển thị Toast
      wsService.broadcastAlert({
        panelId,
        message: alertMsg,
        severity,
        timestamp: new Date().toISOString()
      });
      logger.warn(`ALERT [${panelId}]: ${alertMsg}`);
      
      // 2. Lưu vào DB để làm lịch sử cảnh báo
      db.query(
        `INSERT INTO alerts (panel_id, severity, title, message) VALUES (?, ?, ?, ?)`,
        [panelId, severity === 'danger' ? 'high' : 'medium', 'System Auto Alert', alertMsg]
      ).catch(e => logger.error('Failed to save alert to DB:', e.message));
    }
  }

  /**
   * Get the latest reading for a panel (for REST API fallback)
   */
  getLatestReading(panelId) {
    return this.lastReading[panelId] || null;
  }

  /**
   * Flush buffer: calculate averages and save to DB
   * Called every 60 seconds
   */
  async _flushBuffer() {
    for (const panelId of Object.keys(this.buffer)) {
      const readings = this.buffer[panelId];
      if (readings.length === 0) continue;

      // Calculate averages
      const avg = {
        voltage: this._average(readings, 'voltage'),
        current: this._average(readings, 'current'),
        lightIntensity: Math.round(this._average(readings, 'lightIntensity')),
        servoAngle: Math.round(this._average(readings, 'servoAngle')),
        sampleCount: readings.length,
      };

      // Save averaged reading to database
      try {
        await db.query(
          `INSERT INTO sensor_readings
           (panel_id, voltage, current, light_intensity, servo_angle)
           VALUES (?, ?, ?, ?, ?)`,
          [panelId, avg.voltage.toFixed(2), avg.current.toFixed(2),
           avg.lightIntensity, avg.servoAngle]
        );

        logger.info(
          `Aggregated ${readings.length} readings for ${panelId}: ` +
          `V=${avg.voltage.toFixed(1)} I=${avg.current.toFixed(1)} ` +
          `Light=${avg.lightIntensity} Angle=${avg.servoAngle}`
        );
      } catch (error) {
        logger.error(`Failed to save aggregated reading for ${panelId}:`, error.message);
      }

      // Clear buffer for this panel
      this.buffer[panelId] = [];
    }
  }

  /**
   * Calculate average of a field across readings
   */
  _average(readings, field) {
    if (readings.length === 0) return 0;
    const sum = readings.reduce((acc, r) => acc + (r[field] || 0), 0);
    return sum / readings.length;
  }

  /**
   * Get buffer stats (for debugging)
   */
  getStats() {
    const stats = {};
    for (const [panelId, readings] of Object.entries(this.buffer)) {
      stats[panelId] = {
        bufferedReadings: readings.length,
        lastReading: this.lastReading[panelId] || null,
      };
    }
    return stats;
  }
}

module.exports = new AggregationService();
