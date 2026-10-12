import express from 'express';
const router = express.Router();
import BatchController from '../controllers/batchController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import validate from '../middleware/validate.js';
import { batchSchema } from '../validators/productSchemas.js';

router.use(authenticate);

router.get('/', requirePermission('Batches', 'read'), BatchController.getBatches);
router.post('/', requirePermission('Batches', 'create'), validate(batchSchema), BatchController.createBatch);
router.post('/scan-expiry', requirePermission('Batches', 'update'), BatchController.triggerExpiryScan);

export default router;
