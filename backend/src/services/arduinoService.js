/**
 * Arduino Serial Communication Service
 * Reads sensor data from Arduino via serial port
 * 
 * NOTE: serialport is an optional dependency.
 * If not installed (e.g., missing C++ build tools), the service
 * runs in mock mode and logs a warning.
 */

let SerialPort, ReadlineParser;
let serialAvailable = false;

try {
  ({ SerialPort } = require('serialport'));
  ({ ReadlineParser } = require('@serialport/parser-readline'));
  serialAvailable = true;
} catch (e) {
  // serialport not available — will run in mock mode
}

const logger = require('./logger');
const { _broadcast } = require('./websocketService');

class ArduinoService {
  constructor() {
    this.port = null;
    this.parser = null;
    this.baudRate = 9600;
    this.portPath = process.env.ARDUINO_PORT || 'COM5';
    this.reconnectInterval = 5000;
    this.onDataCallback = null;
    this.isConnected = false;
  }

  /**
   * Set callback for incoming sensor data
   * @param {Function} callback
   */
  onData(callback) {
    this.onDataCallback = callback;
  }

  /**
   * Connect to Arduino serial port
   */
  async connect() {
    if (!serialAvailable) {
      logger.warn('serialport package not installed. Arduino service running in MOCK mode.');
      logger.warn('To use real Arduino, install Visual Studio C++ build tools, then: npm install serialport');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.port = new SerialPort({
          path: this.portPath,
          baudRate: this.baudRate,
        });

        this.parser = this.port.pipe(
          new ReadlineParser({ delimiter: '\n' })
        );

        this.port.on('open', () => {
          this.isConnected = true;
          logger.info(`Arduino connected on ${this.portPath} @ ${this.baudRate} baud`);
          this._listenToData();
          resolve();
        });

        this.port.on('error', (err) => {
          logger.error('Serial port error:', err.message);
          this.isConnected = false;
          reject(err);
        });

        this.port.on('close', () => {
          this.isConnected = false;
          logger.warn(`Arduino disconnected. Reconnecting in ${this.reconnectInterval / 1000}s...`);
          setTimeout(() => this.connect().catch(() => {}), this.reconnectInterval);
        });
      } catch (error) {
        logger.error('Failed to create serial port:', error.message);
        reject(error);
      }
    });
  }

  /**
   * Listen to incoming serial data
   */
  _listenToData() {
    this.parser.on('data', async (line) => {
      try {
        const sensorData = this.parseData(line);
        if (sensorData && this.onDataCallback) {
          await this.onDataCallback(sensorData);
          logger.debug('Sensor data received:', sensorData);
        }
      } catch (error) {
        logger.error('Error processing sensor data:', error.message);
      }
    });
  }

  /**
   * Parse raw serial data line from Arduino
   * Format: "PANEL-001|Voltage|Current|Power|LightAvg|ServoAngle"
   * Example: "PANEL-001|18.50|5.20|96.20|4500|90"
   */
  parseData(line) {
    console.log("==> Nhận được từ Proteus:", line);
    const parts = line.toString().trim().split(',');
    if (parts.length < 6) return null;

    const data = {
      panelId: parts[0],
      voltage: parseFloat(parts[1]),
      current: parseFloat(parts[2]),
      power: parseFloat(parts[3]),
      lightIntensity: parseInt(parts[4]),
      servoAngle: parseInt(parts[5]),
    };
    

    if (isNaN(data.voltage) || isNaN(data.current)) return null;

    return data;
  }catch(err){
    return null;
  }

  /**
   * Send command to Arduino
   */
  async sendCommand(command) {
    if (!this.isConnected || !this.port) {
      throw new Error('Arduino not connected');
    }
    return new Promise((resolve, reject) => {
      this.port.write(command + '\n', (err) => {
        if (err) reject(err);
        else {
          logger.info(`Command sent: ${command}`);
          resolve();
        }
      });
    });
  }

  /**
   * Set servo angle on Arduino
   */
  async setServoAngle(angle) {
    if (angle < 0 || angle > 180) throw new Error('Angle must be 0-180');
    await this.sendCommand(`SERVO:${angle}`);
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      serialAvailable,
      port: this.portPath,
      baudRate: this.baudRate,
    };
  }
}

module.exports = new ArduinoService();
