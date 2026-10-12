import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import path from 'path';
import PurchaseController from '../controllers/purchaseController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission, enforceStoreScope } from '../middleware/rbac.js';
import validate from '../middleware/validate.js';
import { poSchema, grnSchema, vendorInvoiceSchema, overrideSchema, quantityResolutionSchema } from '../validators/purchaseSchemas.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads')),
  filename: (req, file, cb) => cb(null, `invoice-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

router.use(authenticate);
router.use(enforceStoreScope);

router.get('/', requirePermission('PurchaseOrders', 'read'), PurchaseController.getPurchaseOrders);
router.get('/:id', requirePermission('PurchaseOrders', 'read'), PurchaseController.getPOById);
router.post('/', requirePermission('PurchaseOrders', 'create'), validate(poSchema), PurchaseController.createPO);
router.put('/:id/status', requirePermission('PurchaseOrders', 'update'), PurchaseController.updatePOStatus);

router.post('/grn', requirePermission('GRN', 'create'), validate(grnSchema), PurchaseController.createGRN);
router.post('/invoice', requirePermission('VendorInvoices', 'create'), upload.single('invoice_file'), validate(vendorInvoiceSchema), PurchaseController.createVendorInvoice);
router.post('/accept-received-quantity', requirePermission('PurchaseOrders', 'approve'), validate(quantityResolutionSchema), PurchaseController.acceptReceivedQuantity);
router.post('/override', requirePermission('PurchaseOrders', 'approve'), validate(overrideSchema), PurchaseController.overrideDiscrepancy);

export default router;
