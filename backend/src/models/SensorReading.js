/**
 * SensorReading Model
 * Entity: Sensor data from Arduino
 */
class SensorReading {
  constructor(data = {}) {
    this.id = data.id || null;
    this.panelId = data.panel_id || data.panelId || '';
    this.voltage = parseFloat(data.voltage) || 0;       // Volts
    this.current = parseFloat(data.current) || 0;       // Amps
    this.power = parseFloat(data.power) || (this.voltage * this.current); // Watts (calculated)
    this.lightIntensity = parseInt(data.light_intensity || data.lightIntensity) || 0; // Lux
    this.chargeTime = parseInt(data.charge_time || data.chargeTime) || 0;             // Minutes
    this.createdAt = data.created_at || data.createdAt || new Date();
  }

  toDB() {
    return {
      panel_id: this.panelId,
      voltage: this.voltage,
      current: this.current,
      light_intensity: this.lightIntensity,
      charge_time: this.chargeTime,
    };
  }

  static fromDB(row) {
    return new SensorReading(row);
  }

  validate() {
    const errors = [];
    if (!this.panelId) errors.push('panelId is required');
    if (this.voltage < 0 || this.voltage > 100) errors.push('voltage must be 0-100V');
    if (this.current < 0 || this.current > 50) errors.push('current must be 0-50A');
    if (this.lightIntensity < 0 || this.lightIntensity > 100000) errors.push('lightIntensity must be 0-100000 lux');
    if (this.chargeTime < 0 || this.chargeTime > 1440) errors.push('chargeTime must be 0-1440 min');
    return errors;
  }
}

module.exports = SensorReading;
