import express from 'express';
const router = express.Router();
import ReportController from '../controllers/reportController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission, enforceStoreScope } from '../middleware/rbac.js';

router.use(authenticate);
router.use(enforceStoreScope);

router.get('/sales', requirePermission('Reports', 'read'), ReportController.getSalesReport);
router.get('/profit', requirePermission('Reports', 'read'), ReportController.getGrossProfitReport);
router.get('/expiry', requirePermission('Reports', 'read'), ReportController.getExpiryReport);
router.get('/low-stock', requirePermission('Reports', 'read'), ReportController.getLowStockReport);

export default router;
