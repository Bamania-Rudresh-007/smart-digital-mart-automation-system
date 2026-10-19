import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import path from 'path';
import PurchaseController from '../controllers/purchaseController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission, enforceStoreScope } from '../middleware/rbac.js';
import validate from '../middleware/validate.js';
import { poSchema, grnSchema, vendorInvoiceSchema, overrideSchema, quantityResolutionSchema } from '../validators/purchaseSchemas.js';
import ApiResponse from '../utils/apiResponse.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads')),
  filename: (req, file, cb) => cb(null, `invoice-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 2, fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const hasPdfExtension = path.extname(file.originalname).toLowerCase() === '.pdf';
    const hasPdfMimeType = file.mimetype === 'application/pdf' || file.mimetype === 'application/octet-stream';
    if (!hasPdfExtension || !hasPdfMimeType) {
      return cb(new Error('Only PDF documents are accepted.'));
    }
    cb(null, true);
  }
});

const handlePdfUpload = (req, res, next) => {
  pdfUpload.fields([
    { name: 'goods_receipt_note', maxCount: 1 },
    { name: 'supplier_invoice', maxCount: 1 }
  ])(req, res, error => {
    if (error) {
      const statusCode = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return ApiResponse.error(res, error.message, statusCode);
    }
    next();
  });
};

router.use(authenticate);
router.use(enforceStoreScope);

router.get('/', requirePermission('PurchaseOrders', 'read'), PurchaseController.getPurchaseOrders);
router.get('/:id/pdf', requirePermission('PurchaseOrders', 'read'), PurchaseController.downloadPurchaseOrderPdf);
router.get(
  '/:id/validation-samples/:documentType/:scenario',
  requirePermission('PurchaseOrders', 'read'),
  PurchaseController.downloadValidationSample
);
router.post('/:id/validate-documents', requirePermission('PurchaseOrders', 'update'), handlePdfUpload, PurchaseController.validateDocuments);
router.delete('/:id', requirePermission('PurchaseOrders', 'delete'), PurchaseController.deletePurchaseOrder);
router.get('/:id', requirePermission('PurchaseOrders', 'read'), PurchaseController.getPOById);
router.post('/', requirePermission('PurchaseOrders', 'create'), validate(poSchema), PurchaseController.createPO);
router.put('/:id/status', requirePermission('PurchaseOrders', 'update'), PurchaseController.updatePOStatus);

router.post('/grn', requirePermission('GRN', 'create'), validate(grnSchema), PurchaseController.createGRN);
router.post('/invoice', requirePermission('VendorInvoices', 'create'), upload.single('invoice_file'), validate(vendorInvoiceSchema), PurchaseController.createVendorInvoice);
router.post('/accept-received-quantity', requirePermission('PurchaseOrders', 'approve'), validate(quantityResolutionSchema), PurchaseController.acceptReceivedQuantity);
router.post('/override', requirePermission('PurchaseOrders', 'approve'), validate(overrideSchema), PurchaseController.overrideDiscrepancy);

export default router;
