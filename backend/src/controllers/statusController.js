/**
 * Status Controller
 * Manage device status (charging, full, error)
 */
const db = require('../config/database');
const wsService = require('../services/websocketService');

class StatusController {
  // GET /api/status/:panelId
  async getStatus(req, res, next) {
    try {
      const rows = await db.query(
        `SELECT state, error_code, error_message, created_at
         FROM device_status
         WHERE panel_id = ?
         ORDER BY created_at DESC LIMIT 1`,
        [req.params.panelId]
      );
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'No status found' });
      }
      res.json({ success: true, data: rows[0] });
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
        [panelId, state, errorCode || null, errorMessage || null]
      );

      // Broadcast status change via WebSocket
      wsService.broadcastStatus({
        panelId, state, errorCode, errorMessage,
        timestamp: new Date().toISOString(),
      });

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
        `SELECT state, COUNT(*) AS cnt FROM (
           SELECT panel_id, state,
             ROW_NUMBER() OVER (PARTITION BY panel_id ORDER BY created_at DESC) AS rn
           FROM device_status
         ) t WHERE rn = 1
         GROUP BY state`
      );

      const result = { charging: 0, full: 0, errors: 0 };
      let total = 0;
      stats.forEach((row) => {
        result[row.state === 'error' ? 'errors' : row.state] = row.cnt;
        total += row.cnt;
      });

      if (total === 0) total = 1; // avoid division by zero

      res.json({
        success: true,
        data: {
          charging: ((result.charging / total) * 100).toFixed(0),
          full: ((result.full / total) * 100).toFixed(0),
          errors: ((result.errors / total) * 100).toFixed(0),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new StatusController();
