const express = require('express');
const router = express.Router();
const SalesController = require('../controllers/salesController');
const { authenticate } = require('../middleware/auth');
const { requirePermission, enforceStoreScope } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { checkoutSchema } = require('../validators/salesSchemas');

router.use(authenticate);
router.use(enforceStoreScope);

router.post('/checkout', requirePermission('Sales', 'create'), validate(checkoutSchema), SalesController.checkout);
router.get('/', requirePermission('Sales', 'read'), SalesController.getSales);
router.get('/ledger', requirePermission('Sales', 'read'), SalesController.getStockLedger);
router.get('/:id', requirePermission('Sales', 'read'), SalesController.getSaleById);

module.exports = router;
