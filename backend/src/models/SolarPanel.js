/**
 * SolarPanel Model
 * Entity: Panel information
 */
class SolarPanel {
  constructor(data = {}) {
    this.id = data.id || null;
    this.panelId = data.panel_id || data.panelId || '';
    this.location = data.location || '';
    this.angle = data.angle || 45;
    this.status = data.status || 'active'; // active | inactive | error
    this.createdAt = data.created_at || data.createdAt || new Date();
    this.updatedAt = data.updated_at || data.updatedAt || new Date();
  }

  /**
   * Convert to DB-compatible object
   */
  toDB() {
    return {
      panel_id: this.panelId,
      location: this.location,
      angle: this.angle,
      status: this.status,
    };
  }

  /**
   * Create from DB row
   */
  static fromDB(row) {
    return new SolarPanel(row);
  }

  /**
   * Validate panel data
   */
  validate() {
    const errors = [];
    if (!this.panelId) errors.push('panelId is required');
    if (!/^PANEL-\d{3}$/.test(this.panelId)) errors.push('panelId format: PANEL-XXX');
    if (!['active', 'inactive', 'error'].includes(this.status)) {
      errors.push('status must be: active, inactive, or error');
    }
    if (this.angle < 0 || this.angle > 180) errors.push('angle must be 0-180');
    return errors;
  }
}

module.exports = SolarPanel;
