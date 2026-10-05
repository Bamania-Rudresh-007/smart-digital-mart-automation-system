const { AuditLog, User } = require('../models');
const ApiResponse = require('../utils/apiResponse');

class AuditController {
  static async getAuditLogs(req, res, next) {
    try {
      const page = parseInt(req.query.page || '1', 10);
      const limit = parseInt(req.query.limit || '50', 10);
      const offset = (page - 1) * limit;

      const where = {};
      if (req.query.table_name) where.table_name = req.query.table_name;
      if (req.query.action) where.action = req.query.action;
      if (req.query.user_id) where.user_id = req.query.user_id;

      const { count, rows } = await AuditLog.findAndCountAll({
        where,
        limit,
        offset,
        include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
        order: [['timestamp', 'DESC']]
      });

      return ApiResponse.paginated(res, 'Audit logs', rows, page, limit, count);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuditController;
