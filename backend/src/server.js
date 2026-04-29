/**
 * Server Entry Point
 * Starts HTTP server, WebSocket, Arduino connection, and Aggregation
 */
require('dotenv').config();

const http = require('http');
const app = require('./app');
const db = require('./config/database');
const wsService = require('./services/websocketService');
const arduinoService = require('./services/arduinoService');
const aggregationService = require('./services/aggregationService');
const logger = require('./services/logger');

const PORT = process.env.PORT || 5000;

async function startServer() {
  // 1. Test database connection
  const dbOk = await db.testConnection();
  if (!dbOk) {
    logger.warn('Database not available. Server will start, but DB calls may fail.');
  }

  // 2. Create HTTP server
  const server = http.createServer(app);

  // 3. Initialize WebSocket
  wsService.init(server);

  // 4. Start Aggregation Service (saves averages to DB every 60s)
  aggregationService.start();

  // 5. Start listening
  server.listen(PORT, () => {
    logger.info(`🚀 Server running on http://localhost:${PORT}`);
    logger.info(`📡 WebSocket available at ws://localhost:${PORT}/ws`);
    logger.info(`🔋 Dashboard at http://localhost:${PORT}`);
    logger.info(`❤️  Health check at http://localhost:${PORT}/api/health`);
  });

  // 6. Connect to Arduino via COMPIM/Serial (non-blocking)
  try {
    arduinoService.onData(async (sensorData) => {
      // Feed raw data into aggregation service (every ~1 second)
      // Aggregation will: buffer → average per minute → save to DB
      // and also: broadcast real-time via WebSocket
      aggregationService.addReading(sensorData);
    });

    await arduinoService.connect();
    logger.info('🔌 Arduino connected via Proteus COMPIM');
  } catch (error) {
    logger.warn(`Arduino not connected: ${error.message}. Running without serial data.`);
  }

  // 7. Make arduinoService available for servo control from routes
  app.set('arduinoService', arduinoService);
  app.set('aggregationService', aggregationService);

  // 8. Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`${signal} received. Shutting down...`);
    aggregationService.stop();
    server.close(async () => {
      await db.close();
      logger.info('Server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection:', reason);
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });
}

startServer();
