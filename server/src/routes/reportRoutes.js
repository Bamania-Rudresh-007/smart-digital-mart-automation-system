const express = require('express');
const router = express.Router();
const ReportController = require('../controllers/reportController');
const { authenticate } = require('../middleware/auth');
const { requirePermission, enforceStoreScope } = require('../middleware/rbac');

router.use(authenticate);
router.use(enforceStoreScope);

router.get('/sales', requirePermission('Reports', 'read'), ReportController.getSalesReport);
router.get('/profit', requirePermission('Reports', 'read'), ReportController.getGrossProfitReport);
router.get('/expiry', requirePermission('Reports', 'read'), ReportController.getExpiryReport);
router.get('/low-stock', requirePermission('Reports', 'read'), ReportController.getLowStockReport);

module.exports = router;
