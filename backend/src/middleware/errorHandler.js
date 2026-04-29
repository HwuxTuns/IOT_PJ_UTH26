/**
 * Error Handler Middleware
 * Centralized error handling for all routes
 */
const logger = require('../services/logger');

const errorHandler = (err, req, res, _next) => {
  // Log error details
  logger.error({
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.originalUrl,
    body: req.body,
  });

  // MySQL specific errors
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      error: 'Duplicate entry. Resource already exists.',
    });
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      success: false,
      error: 'Referenced resource not found (invalid foreign key).',
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(403).json({
      success: false,
      error: 'Authentication failed: ' + err.message,
    });
  }

  // Default 500 error
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
};

module.exports = errorHandler;
