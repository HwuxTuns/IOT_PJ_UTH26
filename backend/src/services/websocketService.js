/**
 * WebSocket Service
 * Broadcasts real-time sensor data to connected frontend clients
 */
const { WebSocketServer } = require('ws');
const logger = require('./logger');

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Set();
  }

  /**
   * Initialize WebSocket server on existing HTTP server
   * @param {http.Server} server
   */
  init(server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws, req) => {
      this.clients.add(ws);
      const ip = req.socket.remoteAddress;
      logger.info(`WS client connected from ${ip} (total: ${this.clients.size})`);

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'welcome',
        data: { message: 'Connected to Solar Monitor', clients: this.clients.size },
      }));

      ws.on('close', () => {
        this.clients.delete(ws);
        logger.info(`WS client disconnected (total: ${this.clients.size})`);
      });

      ws.on('error', (err) => {
        logger.error('WS client error:', err.message);
        this.clients.delete(ws);
      });
    });

    logger.info('WebSocket server initialized on /ws');
  }

  /**
   * Broadcast new sensor reading to all connected clients
   * @param {Object} data - Sensor reading data
   */
  broadcastReading(data) {
    this._broadcast({ type: 'new-reading', data });
  }

  /**
   * Broadcast device status change
   * @param {Object} data - Status data
   */
  broadcastStatus(data) {
    this._broadcast({ type: 'status-change', data });
  }

  /**
   * Broadcast alert
   * @param {Object} data - Alert data
   */
  broadcastAlert(data) {
    this._broadcast({ type: 'alert', data });
  }

  /**
   * Internal broadcast helper
   */
  _broadcast(payload) {
    const message = JSON.stringify(payload);
    let sent = 0;
    this.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(message);
        sent++;
      }
    });
    if (sent > 0) {
      logger.debug(`WS broadcast [${payload.type}] to ${sent} clients`);
    }
  }

  /**
   * Get current connection count
   */
  getClientCount() {
    return this.clients.size;
  }
}

module.exports = new WebSocketService();
