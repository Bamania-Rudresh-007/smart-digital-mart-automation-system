const { Alert, AlertRule, Notification } = require('../models');
const ApiResponse = require('../utils/apiResponse');

class AlertController {
  static async getAlerts(req, res, next) {
    try {
      const where = {};
      if (req.targetStoreId) where.store_id = req.targetStoreId;
      if (req.query.type) where.type = req.query.type;
      if (req.query.status) where.status = req.query.status;

      const alerts = await Alert.findAll({
        where,
        order: [['createdAt', 'DESC']]
      });

      return ApiResponse.success(res, 'Alerts list', alerts);
    } catch (error) {
      next(error);
    }
  }

  static async markAlertRead(req, res, next) {
    try {
      const alert = await Alert.findByPk(req.params.id);
      if (!alert) return ApiResponse.error(res, 'Alert not found', 404);

      alert.status = 'read';
      await alert.save();
      return ApiResponse.success(res, 'Alert marked as read', alert);
    } catch (error) {
      next(error);
    }
  }

  static async getNotifications(req, res, next) {
    try {
      const notifications = await Notification.findAll({
        where: { user_id: req.user.id },
        order: [['createdAt', 'DESC']]
      });
      return ApiResponse.success(res, 'Notifications list', notifications);
    } catch (error) {
      next(error);
    }
  }

  static async markNotificationRead(req, res, next) {
    try {
      const notif = await Notification.findOne({
        where: { id: req.params.id, user_id: req.user.id }
      });
      if (!notif) return ApiResponse.error(res, 'Notification not found', 404);

      notif.is_read = true;
      await notif.save();
      return ApiResponse.success(res, 'Notification marked read', notif);
    } catch (error) {
      next(error);
    }
  }

  static async getAlertRules(req, res, next) {
    try {
      const where = {};
      if (req.targetStoreId) where.store_id = req.targetStoreId;
      const rules = await AlertRule.findAll({ where });
      return ApiResponse.success(res, 'Alert rules', rules);
    } catch (error) {
      next(error);
    }
  }

  static async saveAlertRule(req, res, next) {
    try {
      const storeId = req.targetStoreId || req.body.store_id;
      const { alert_type, recipient_emails, notification_channels } = req.body;

      let rule = await AlertRule.findOne({ where: { store_id: storeId, alert_type } });
      if (rule) {
        rule.recipient_emails = recipient_emails;
        rule.notification_channels = notification_channels;
        await rule.save();
      } else {
        rule = await AlertRule.create({
          store_id: storeId,
          alert_type,
          recipient_emails,
          notification_channels
        });
      }

      return ApiResponse.success(res, 'Alert rule saved', rule);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AlertController;
