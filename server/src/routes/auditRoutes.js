import express from 'express';
const router = express.Router();
import AuditController from '../controllers/auditController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

router.use(authenticate);

router.get('/', requirePermission('AuditLogs', 'read'), AuditController.getAuditLogs);

export default router;
