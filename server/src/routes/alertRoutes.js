import express from 'express';
const router = express.Router();
import AlertController from '../controllers/alertController.js';
import { authenticate } from '../middleware/auth.js';
import { enforceStoreScope } from '../middleware/rbac.js';

router.use(authenticate);
router.use(enforceStoreScope);

router.get('/', AlertController.getAlerts);
router.put('/:id/read', AlertController.markAlertRead);

router.get('/notifications/me', AlertController.getNotifications);
router.put('/notifications/:id/read', AlertController.markNotificationRead);

router.get('/rules', AlertController.getAlertRules);
router.post('/rules', AlertController.saveAlertRule);

export default router;
