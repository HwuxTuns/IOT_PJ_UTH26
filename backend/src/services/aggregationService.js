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

    // Broadcast real-time to all WebSocket clients
    wsService.broadcastReading(this.lastReading[panelId]);
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
