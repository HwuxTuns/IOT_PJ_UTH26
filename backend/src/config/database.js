const mysql = require('mysql2/promise');
const logger = require('../services/logger');

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      database: process.env.DB_NAME || 'iot_solar_db',
      user: process.env.DB_USER || 'solar_user',
      password: process.env.DB_PASSWORD || 'solar_pass123',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });

    logger.info('MySQL connection pool created');
  }
  return pool;
}

const db = {
  /**
   * Execute a parameterized query
   * @param {string} sql - SQL query string
   * @param {Array} params - Query parameters
   * @returns {Promise<Array>} Query results
   */
  async query(sql, params = []) {
    const pool = getPool();
    const [rows] = await pool.execute(sql, params);
    return rows;
  },

  /**
   * Get raw pool for transactions
   */
  getPool,

  /**
   * Test database connection
   */
  async testConnection() {
    try {
      const pool = getPool();
      const connection = await pool.getConnection();
      await connection.ping();
      connection.release();
      logger.info('Database connection successful');
      return true;
    } catch (error) {
      logger.error('Database connection failed:', error.message);
      return false;
    }
  },

  /**
   * Close all connections
   */
  async close() {
    if (pool) {
      await pool.end();
      pool = null;
      logger.info('Database connections closed');
    }
  },
};

module.exports = db;
