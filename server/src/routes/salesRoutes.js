import express from 'express';
const router = express.Router();
import SalesController from '../controllers/salesController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission, enforceStoreScope } from '../middleware/rbac.js';
import validate from '../middleware/validate.js';
import { checkoutSchema } from '../validators/salesSchemas.js';

router.use(authenticate);
router.use(enforceStoreScope);

router.post('/checkout', requirePermission('Sales', 'create'), validate(checkoutSchema), SalesController.checkout);
router.get('/', requirePermission('Sales', 'read'), SalesController.getSales);
router.get('/ledger', requirePermission('Sales', 'read'), SalesController.getStockLedger);
router.get('/:id', requirePermission('Sales', 'read'), SalesController.getSaleById);

export default router;
