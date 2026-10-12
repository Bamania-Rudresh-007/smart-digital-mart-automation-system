import express from 'express';
const router = express.Router();
import SupplierController from '../controllers/supplierController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import validate from '../middleware/validate.js';
import { supplierSchema } from '../validators/productSchemas.js';

router.use(authenticate);

router.get('/', requirePermission('PurchaseOrders', 'read'), SupplierController.getSuppliers);
router.post('/', requirePermission('PurchaseOrders', 'create'), validate(supplierSchema), SupplierController.createSupplier);

export default router;
