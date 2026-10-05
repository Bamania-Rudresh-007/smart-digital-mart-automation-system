const express = require('express');
const router = express.Router();
const AlertController = require('../controllers/alertController');
const { authenticate } = require('../middleware/auth');
const { enforceStoreScope } = require('../middleware/rbac');

router.use(authenticate);
router.use(enforceStoreScope);

router.get('/', AlertController.getAlerts);
router.put('/:id/read', AlertController.markAlertRead);

router.get('/notifications/me', AlertController.getNotifications);
router.put('/notifications/:id/read', AlertController.markNotificationRead);

router.get('/rules', AlertController.getAlertRules);
router.post('/rules', AlertController.saveAlertRule);

module.exports = router;
