/**
 * Validation Middleware
 * Input validation for API endpoints
 */

// Validate panelId format: PANEL-001, PANEL-999, etc.
const validatePanelId = (req, res, next) => {
  const panelId = req.params.panelId || req.body.panelId || req.query.panelId;
  if (panelId && !/^PANEL-\d{3}$/.test(panelId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid panelId format. Expected: PANEL-XXX (e.g., PANEL-001)',
    });
  }
  next();
};

// Validate sensor reading data ranges
const validateReading = (req, res, next) => {
  const { voltage, current, lightIntensity, chargeTime } = req.body;
  const errors = [];

  if (voltage !== undefined && (voltage < 0 || voltage > 100)) {
    errors.push('voltage must be between 0 and 100 V');
  }
  if (current !== undefined && (current < 0 || current > 50)) {
    errors.push('current must be between 0 and 50 A');
  }
  if (lightIntensity !== undefined && (lightIntensity < 0 || lightIntensity > 100000)) {
    errors.push('lightIntensity must be between 0 and 100000 lux');
  }
  if (chargeTime !== undefined && (chargeTime < 0 || chargeTime > 1440)) {
    errors.push('chargeTime must be between 0 and 1440 minutes');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }
  next();
};

// Validate query params for history endpoint
const validateHistoryQuery = (req, res, next) => {
  const { days } = req.query;
  if (days !== undefined) {
    const parsed = parseInt(days);
    if (isNaN(parsed) || parsed < 1 || parsed > 365) {
      return res.status(400).json({
        success: false,
        error: 'days must be an integer between 1 and 365',
      });
    }
  }
  next();
};

// Validate device status state
const validateStatus = (req, res, next) => {
  const { state } = req.body;
  const validStates = ['charging', 'full', 'error'];
  if (state && !validStates.includes(state)) {
    return res.status(400).json({
      success: false,
      error: `state must be one of: ${validStates.join(', ')}`,
    });
  }
  next();
};

module.exports = {
  validatePanelId,
  validateReading,
  validateHistoryQuery,
  validateStatus,
};
