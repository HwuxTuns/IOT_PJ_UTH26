/**
 * Express Application
 * Configures middleware, routes, and error handling
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');

const app = express();

// ─── Security Headers ───
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for dashboard
}));

// ─── CORS ───
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body Parsing ───
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Request Logging ───
app.use(requestLogger);

// ─── Rate Limiting (POST endpoints) ───
const postLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10000, // Cho phép tối đa 10000 request/phút (thoải mái cho IoT gửi từng giây)
  message: { success: false, error: 'Too many requests. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/readings', postLimiter);
app.use('/api/status', postLimiter);

// ─── Serve Frontend Static Files ───
app.use(express.static(path.join(__dirname, '../../'), {
  index: 'index.html',
}));

// ─── API Routes ───
app.use('/api', routes);

// ─── 404 Handler ───
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// ─── Error Handler (must be last) ───
app.use(errorHandler);

module.exports = app;
