/**
 * Panel Controller
 * CRUD operations for solar panels
 */
const db = require('../config/database');

class PanelController {
  // GET /api/panels
  async getAllPanels(req, res, next) {
    try {
      const panels = await db.query('SELECT * FROM solar_panels ORDER BY created_at DESC');
      res.json({ success: true, data: panels });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/panels/:panelId
  async getPanelDetail(req, res, next) {
    try {
      const rows = await db.query(
        'SELECT * FROM solar_panels WHERE panel_id = ?',
        [req.params.panelId]
      );
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Panel not found' });
      }
      res.json({ success: true, data: rows[0] });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/panels
  async createPanel(req, res, next) {
    try {
      const { panelId, location, angle } = req.body;
      await db.query(
        'INSERT INTO solar_panels (panel_id, location, angle) VALUES (?, ?, ?)',
        [panelId, location, angle || 45]
      );
      res.status(201).json({ success: true, message: 'Panel created' });
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/panels/:panelId
  async updatePanel(req, res, next) {
    try {
      const { location, angle, status } = req.body;
      const result = await db.query(
        'UPDATE solar_panels SET location = COALESCE(?, location), angle = COALESCE(?, angle), status = COALESCE(?, status) WHERE panel_id = ?',
        [location, angle, status, req.params.panelId]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, error: 'Panel not found' });
      }
      res.json({ success: true, message: 'Panel updated' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PanelController();
