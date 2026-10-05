const express = require('express');
const router = express.Router();
const SupplierController = require('../controllers/supplierController');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { supplierSchema } = require('../validators/productSchemas');

router.use(authenticate);

router.get('/', requirePermission('PurchaseOrders', 'read'), SupplierController.getSuppliers);
router.post('/', requirePermission('PurchaseOrders', 'create'), validate(supplierSchema), SupplierController.createSupplier);

module.exports = router;
