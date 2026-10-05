const { AuditLog } = require('../models');
const logger = require('../utils/logger');

class AuditService {
  static async logAction({ userId, action, tableName, recordId, oldValue = null, newValue = null }) {
    try {
      await AuditLog.create({
        user_id: userId || null,
        action,
        table_name: tableName,
        record_id: recordId ? String(recordId) : null,
        old_value: oldValue ? JSON.stringify(oldValue) : null,
        new_value: newValue ? JSON.stringify(newValue) : null
      });
    } catch (err) {
      logger.error('Failed to create audit log entry: ' + err.message);
    }
  }
}

module.exports = AuditService;
