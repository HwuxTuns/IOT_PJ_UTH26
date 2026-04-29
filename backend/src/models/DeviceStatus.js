/**
 * DeviceStatus Model
 * Entity: Device state (charging, full, error)
 */
class DeviceStatus {
  constructor(data = {}) {
    this.id = data.id || null;
    this.panelId = data.panel_id || data.panelId || '';
    this.state = data.state || 'charging'; // charging | full | error
    this.errorCode = data.error_code || data.errorCode || null;
    this.errorMessage = data.error_message || data.errorMessage || null;
    this.createdAt = data.created_at || data.createdAt || new Date();
  }

  toDB() {
    return {
      panel_id: this.panelId,
      state: this.state,
      error_code: this.errorCode,
      error_message: this.errorMessage,
    };
  }

  static fromDB(row) {
    return new DeviceStatus(row);
  }

  validate() {
    const errors = [];
    if (!this.panelId) errors.push('panelId is required');
    if (!['charging', 'full', 'error'].includes(this.state)) {
      errors.push('state must be: charging, full, or error');
    }
    if (this.state === 'error' && !this.errorCode) {
      errors.push('errorCode is required when state is error');
    }
    return errors;
  }
}

module.exports = DeviceStatus;
