const express = require('express');
const router = express.Router();
const { auditLogs } = require('../db/store');
const { verifyToken, requireAdmin, requireTenant } = require('../middleware/tenantIsolation');

/**
 * GET /api/audit-logs
 * Enterprise Immutable Audit Trail - Filtered by tenant for compliance
 */
router.get('/', verifyToken, requireAdmin, requireTenant, (req, res) => {
  try {
    const filter = {
      limit: req.query.limit || 100,
      action: req.query.action || ''
    };

    if (req.isSuperAdmin && req.query.tenantId) {
      filter.tenantId = req.query.tenantId;
    } else {
      filter.tenantId = req.tenantId;
    }

    const logs = auditLogs.getAll(filter);

    res.json({
      success: true,
      count: logs.length,
      tenantId: filter.tenantId || 'all',
      logs
    });
  } catch (error) {
    console.error('[Audit] Error fetching logs:', error);
    res.status(500).json({ message: 'Error retrieving security audit logs', error: error.message });
  }
});

module.exports = router;
