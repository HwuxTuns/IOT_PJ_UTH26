/**
 * Request Logger Middleware
 * Logs all incoming HTTP requests with duration
 */
const logger = require('../services/logger');

const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.socket.remoteAddress,
    };

    if (res.statusCode >= 400) {
      logger.warn(logData);
    } else {
      logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
    }
  });

  next();
};

module.exports = requestLogger;
