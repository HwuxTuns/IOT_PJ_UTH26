/**
 * Reading Controller
 * Save/fetch sensor readings for charts and KPIs
 */
const db = require('../config/database');
const wsService = require('../services/websocketService');

class ReadingController {
  // GET /api/readings/latest/:panelId (for KPI display)
  async getLatestReading(req, res, next) {
    try {
      const rows = await db.query(
        `SELECT voltage, current, power, light_intensity, servo_angle, created_at
         FROM sensor_readings
         WHERE panel_id = ?
         ORDER BY created_at DESC LIMIT 1`,
        [req.params.panelId]
      );
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'No readings found' });
      }
      res.json({ success: true, data: rows[0] });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/readings (save from Arduino)
  async createReading(req, res, next) {
    try {
      const { panelId, voltage, current, lightIntensity, servoAngle } = req.body;
      // power is auto-calculated by DB generated column
      await db.query(
        `INSERT INTO sensor_readings
         (panel_id, voltage, current, light_intensity, servo_angle)
         VALUES (?, ?, ?, ?, ?)`,
        [panelId, voltage, current, lightIntensity, servoAngle || 90]
      );

      // Broadcast to WebSocket clients
      wsService.broadcastReading({
        panelId, voltage, current,
        power: +(voltage * current).toFixed(2),
        lightIntensity, servoAngle: servoAngle || 90,
        timestamp: new Date().toISOString(),
      });

      res.status(201).json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/readings/daily/:panelId (for daily line chart)
  async getDailyReadings(req, res, next) {
    try {
      const readings = await db.query(
        `SELECT reading_hour AS hour, AVG(power) AS avg_power
         FROM sensor_readings
         WHERE panel_id = ? AND reading_date = CURDATE()
         GROUP BY reading_hour
         ORDER BY hour ASC`,
        [req.params.panelId]
      );

      // Fill 24 hours with data or 0
      const chartData = Array(24).fill(0);
      readings.forEach((r) => {
        chartData[r.hour] = parseFloat(r.avg_power) || 0;
      });

      res.json({ success: true, data: chartData });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/readings/weekly/:panelId (for weekly bar chart)
  async getWeeklyReadings(req, res, next) {
    try {
      const INTERVAL_S = 60; // Each row = 1-minute average from aggregation
      const readings = await db.query(
        `SELECT reading_date,
                SUM(power * ${INTERVAL_S}) / 3600 / 1000 AS kwh
         FROM sensor_readings
         WHERE panel_id = ? AND reading_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
         GROUP BY reading_date
         ORDER BY reading_date ASC`,
        [req.params.panelId]
      );

      const kwhData = readings.map((r) => parseFloat(r.kwh).toFixed(1));
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
         ORDER BY created_at DESC
         LIMIT 200`,
        [panelId, parseInt(days)]
      );
      res.json({ success: true, data: history });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ReadingController();
