/**
 * API Routes
 * All REST endpoints for the IoT Solar Monitor
 */
const express = require('express');
const router = express.Router();

// Controllers
const panelController = require('../controllers/panelController');
const readingController = require('../controllers/readingController');
const statusController = require('../controllers/statusController');

// Middleware
const { validatePanelId, validateReading, validateHistoryQuery, validateStatus } = require('../middleware/validationMiddleware');
const { authMiddleware } = require('../middleware/authMiddleware');
const db = require('../config/database');

// ─── Health ───
router.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    const aggregation = req.app.get('aggregationService');
    const arduino = req.app.get('arduinoService');
    res.json({
      success: true,
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      arduino: arduino ? arduino.getStatus() : { connected: false },
      aggregation: aggregation ? aggregation.getStats() : {},
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: 'Database connection failed',
    });
  }
});

// ─── Real-time Latest (from memory buffer, not DB) ───
router.get('/realtime/latest/:panelId', validatePanelId, (req, res) => {
  const aggregation = req.app.get('aggregationService');
  if (!aggregation) {
    return res.status(503).json({ success: false, error: 'Aggregation not ready' });
  }
  const data = aggregation.getLatestReading(req.params.panelId);
  if (!data) {
    return res.status(404).json({ success: false, error: 'No real-time data available' });
  }
  res.json({ success: true, data });
});

// ─── Servo Control ───
router.post('/control/servo', async (req, res, next) => {
  try {
    const { angle } = req.body;
    if (angle === undefined || angle < 0 || angle > 180) {
      return res.status(400).json({
        success: false,
        error: 'angle is required and must be between 0 and 180',
      });
    }

    const arduino = req.app.get('arduinoService');

    // Cách 1: Gửi trực tiếp qua serialport (nếu có)
    if (arduino && arduino.isConnected) {
      await arduino.setServoAngle(parseInt(angle));
      return res.json({ success: true, message: `Servo set to ${angle}°` });
    }

    // Cách 2: Gửi qua Python bridge (http://localhost:5001/servo)
    try {
      const bridgeRes = await fetch('http://localhost:5001/servo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ angle: parseInt(angle) }),
      });
      const bridgeData = await bridgeRes.json();
      if (bridgeData.success) {
        return res.json({ success: true, message: `Servo set to ${angle}° (via bridge)` });
      }
      return res.status(500).json({ success: false, error: 'Bridge failed' });
    } catch (bridgeErr) {
      return res.status(503).json({
        success: false,
        error: 'Arduino not connected. Start bridge.py or install serialport.',
      });
    }
  } catch (error) {
    next(error);
  }
});

// ─── Arduino Status ───
router.get('/arduino/status', (req, res) => {
  const arduino = req.app.get('arduinoService');
  res.json({
    success: true,
    data: arduino ? arduino.getStatus() : { connected: false, serialAvailable: false },
  });
});

// ─── Panel Endpoints ───
router.get('/panels', panelController.getAllPanels);
router.get('/panels/:panelId', validatePanelId, panelController.getPanelDetail);
router.post('/panels', authMiddleware, validatePanelId, panelController.createPanel);
router.put('/panels/:panelId', authMiddleware, validatePanelId, panelController.updatePanel);

// ─── Reading Endpoints ───
router.get('/readings/latest/:panelId', validatePanelId, readingController.getLatestReading);
router.post('/readings', validatePanelId, validateReading, readingController.createReading);
router.get('/readings/daily/:panelId', validatePanelId, readingController.getDailyReadings);
router.get('/readings/weekly/:panelId', validatePanelId, readingController.getWeeklyReadings);
router.get('/readings/history', validatePanelId, validateHistoryQuery, readingController.getHistory);

// ─── Status Endpoints (specific routes BEFORE parameterized routes) ───
router.get('/status/system/overview', statusController.getSystemOverview);
router.get('/status/:panelId', validatePanelId, statusController.getStatus);
router.post('/status', authMiddleware, validatePanelId, validateStatus, statusController.updateStatus);

module.exports = router;
