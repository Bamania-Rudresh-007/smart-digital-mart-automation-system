const express = require('express');
const router = express.Router();
const AuditController = require('../controllers/auditController');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

router.use(authenticate);

router.get('/', requirePermission('AuditLogs', 'read'), AuditController.getAuditLogs);

module.exports = router;
