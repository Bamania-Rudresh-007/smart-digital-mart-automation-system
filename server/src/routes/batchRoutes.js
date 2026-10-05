const express = require('express');
const router = express.Router();
const BatchController = require('../controllers/batchController');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { batchSchema } = require('../validators/productSchemas');

router.use(authenticate);

router.get('/', requirePermission('Batches', 'read'), BatchController.getBatches);
router.post('/', requirePermission('Batches', 'create'), validate(batchSchema), BatchController.createBatch);
router.post('/scan-expiry', requirePermission('Batches', 'update'), BatchController.triggerExpiryScan);

module.exports = router;
