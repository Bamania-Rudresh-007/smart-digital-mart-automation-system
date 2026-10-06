const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const PurchaseController = require('../controllers/purchaseController');
const { authenticate } = require('../middleware/auth');
const { requirePermission, enforceStoreScope } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { poSchema, grnSchema, vendorInvoiceSchema, overrideSchema, quantityResolutionSchema } = require('../validators/purchaseSchemas');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.resolve(__dirname, '../../uploads')),
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

module.exports = router;
